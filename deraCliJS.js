// Diode Service using diode_js library

const express = require('express');
const app = express();
const nconf = require('nconf');
const cors = require('cors');
const { DiodeConnection, DiodeRPC, PublishPort, BindPort } = require('diodejs');
const path = require('path');

nconf.use('file', { file: './config.json' });

app.use(cors());
app.use(express.json());

class DiodeService {
  constructor() {
    this.connection = null;
    this.certPath = path.resolve(__dirname, 'device_certificate.pem');
    this.host = 'us2.prenet.diode.io'; // Adjust as necessary
    this.port = 41046;
    this.status = 0; // 0: idle, 1: connecting, 2: connected, 3: binding, 4: publishing
    this.isPublishActive = false;
    this.runningClients = [];
    this.address = null;
    this.domain = null;

    this.initialize();
  }

  async initialize() {
    nconf.load();
    this.isPublishActive = nconf.get('isPublishActive') === 'true';
    if (this.isPublishActive) {
      await this.publishOnStart();
    }
  }

  async connect() {
    if (!this.connection) {
      this.status = 1; // Connecting
      this.connection = new DiodeConnection(this.host, this.port, this.certPath);
      await this.connection.connect();
      this.status = 2; // Connected
    }
  }

  async disconnect() {
    if (this.connection) {
      await this.connection.close();
      this.connection = null;
      this.status = 0; // Idle
    }
  }

  async getAddress() {
    try {
      this.address = this.connection.getEthereumAddress();
    } catch (error) {
      console.error('Error fetching client address:', error);
      this.status = 0; // Error
    }
  }

  async publishPorts(ports, mode = 'public', remoteAddress = '0x0') {
    try {
      await this.connect();
      this.status = 4; // Publishing
      const parsedPorts = ports.map(Number);
      const publishOptions = { mode, remoteAddress };
      const publishPort = new PublishPort(this.connection, parsedPorts, this.certPath);
      this.runningClients.push(publishPort);
      console.log(`Published ports: ${ports.join(', ')} in ${mode} mode`);
    } catch (error) {
      console.error('Error publishing ports:', error);
      this.status = 0; // Error
    }
  }

  async bindPorts(ports, remoteAddress) {
    try {
      await this.connect();
      this.status = 3; // Binding
      const parsedPorts = ports.map(Number);
      const bindPort = new BindPort(this.connection, ports[0],ports[0], remoteAddress);
      this.runningClients.push(bindPort);
      console.log(`Bound ports: ${ports.join(', ')} to address ${remoteAddress}`);
    } catch (error) {
      console.error('Error binding ports:', error);
      this.status = 0; // Error
    }
  }

  async addBNSRecord(bnsName) {
    if (!this.isValidBNSName(bnsName)) {
      throw new Error('Invalid BNS Name');
    }
    try {
      await this.connect();
      const rpc = new DiodeRPC(this.connection);
      await rpc.registerBNS(bnsName); // Assuming such method exists
      console.log(`BNS record added: ${bnsName}`);
    } catch (error) {
      console.error('Error adding BNS record:', error);
      this.status = 0; // Error
    }
  }

  isValidBNSName(bnsName) {
    return bnsName.length > 8;
  }

  isValidMode(mode) {
    return ['private', 'public', 'protected'].includes(mode);
  }

  async publishOnStart() {
    const defaultPorts = nconf.get('defaultPorts').split(',').map(Number);
    const defaultMode = nconf.get('defaultMode');
    const defaultRemoteAddr = nconf.get('defaultRemoteAddr');

    if (defaultPorts.length > 0) {
      await this.publishPorts(defaultPorts, defaultMode, defaultRemoteAddr);
    } else {
      console.warn('No default ports specified for publishing.');
    }
  }

  async stopPublishing() {
    try {
      for (const client of this.runningClients) {
        await client.close(); // Assuming close method exists
      }
      this.runningClients = [];
      this.status = 0; // Idle
      console.log('Stopped all publishing clients.');
    } catch (error) {
      console.error('Error stopping publishing:', error);
    }
  }
}

const diodeService = new DiodeService();

diodeService.connect().then(() => {
  diodeService.getAddress();
});

// Express Routes

app.get('/diode/address', async (req, res) => {
  try {
    res.json({ address: diodeService.address, domain: diodeService.domain });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve address' });
  }
});

app.get('/diode/status', (req, res) => {
  res.json({ status: diodeService.status });
});

app.get('/diode/stop', async (req, res) => {
  try {
    await diodeService.stopPublishing();
    res.json({ status: diodeService.status });
  } catch (error) {
    res.status(500).json({ error: 'Failed to stop publishing' });
  }
});

app.get('/diode/publish/:ports/:mode/:remoteAddress?', async (req, res) => {
  const { ports, mode, remoteAddress = '0x0' } = req.params;
  if (!diodeService.isValidMode(mode)) {
    return res.status(400).json({ error: 'Invalid mode' });
  }
  if (diodeService.status !== 0) {
    return res.status(409).json({ error: 'Diode is already publishing' });
  }
  try {
    const portList = ports.split(',').map(Number);
    await diodeService.publishPorts(portList, mode, remoteAddress);
    res.json({ status: diodeService.status, result: 1 });
  } catch (error) {
    res.status(500).json({ error: 'Failed to publish ports' });
  }
});

app.get('/diode/bind/:ports/:address', async (req, res) => {
  const { ports, address } = req.params;
  if (diodeService.status !== 0) {
    return res.status(409).json({ error: 'Diode is already binding' });
  }
  try {
    const portList = ports.split(',').map(Number);
    await diodeService.bindPorts(portList, address);
    res.json({ status: diodeService.status, result: 1 });
  } catch (error) {
    res.status(500).json({ error: 'Failed to bind ports' });
  }
});

app.get('/diode/addBNS/:bnsName', async (req, res) => {
  const { bnsName } = req.params;
  try {
    await diodeService.addBNSRecord(bnsName);
    res.json({ status: diodeService.status, result: 1 });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/setPublishActive/:value', (req, res) => {
  const { value } = req.params;
  if (['true', 'false'].includes(value)) {
    nconf.set('isPublishActive', value);
    nconf.save();
    diodeService.isPublishActive = value === 'true';
    res.json({ isPublishActive: value });
  } else {
    res.status(400).json({ error: 'Invalid value' });
  }
});

app.get('/diode', (req, res) => {
  if (diodeService.status === 0) {
    res.json({ status: diodeService.status });
  } else {
    res.json({ status: diodeService.status});
  }
});

app.get('/setDefault/:ports/:mode/:remoteAddr?', (req, res) => {
  const { ports, mode, remoteAddr = '' } = req.params;
  if (!diodeService.isValidMode(mode)) {
    return res.status(400).json({ error: 'Invalid mode' });
  }
  nconf.set('defaultPorts', ports);
  nconf.set('defaultMode', mode);
  if (remoteAddr) {
    nconf.set('defaultRemoteAddr', remoteAddr);
  }
  nconf.save();
  res.json({ defaultPorts: ports, defaultMode: mode, defaultRemoteAddr: remoteAddr });
});

app.listen(3000, () => {
  console.log('Diode service is running on port 3000.');
});
