//This is a Windows Service to launch diode in the background
var express = require('express');
var app = express();
var store = require('nconf');
store.use('file', { file: './config.json' });
var status = 0;
let killVar=0;

runningClients = [];

appRootDir = require('app-root-dir').get();
if(appRootDir.indexOf("daemon")){
  appRootDir = `${appRootDir.slice(0,appRootDir.indexOf("daemon"))}`
}
const diodePath = appRootDir + 'I/bin/diode.exe';
const spawn = require( 'child_process' ).spawn;
let child; 
//Stops diode
async function killDiodeCLI(){
  killVar=1
  child.kill();
}
getAddr();

//returns address and domain of the client with get request
app.get('/diode/address', function(req, res) {
  res.send(JSON.stringify({address: global.addrs,domain: global.domain}) );
});

//returns hello world
app.get('/', function (req, res) {
    res.send('Hello World!');
});

//Sets Diode Fleet
app.get('/diode/fleet/:fleet', function(req, res) {
  setDiodeFleet(req.params.fleet);
  res.send(JSON.stringify({status: status, set: true }) );
});

//sets isPublishActive to requested value
app.get('/setPublishActive/:value', function (req, res) {
  value = req.params.value;
  if(value == "true"||value == "false"){
    store.set('isPublishActive', req.params.value);
    store.save();
    res.send(JSON.stringify({isPublishActive: req.params.value}));
  }else{
    res.send(JSON.stringify({error: "Invalid value"}));
  }
});

//Sets Default Port, publishmode and remote address values
app.get('/setDefault/:ports/:mode/:remoteAddr', function (req, res) {
  if(isValidMode(req.params.mode)){
    store.set('defaultPorts', req.params.ports);
    store.set('defaultMode', req.params.mode);
    store.set('defaultRemoteAddr', req.params.remoteAddr);
    store.save();
    res.send(JSON.stringify({defaultPorts: req.params.ports,defaultMode: req.params.mode,defaultRemoteAddr: req.params.remoteAddr}));
  }else{
    res.send(JSON.stringify({error: "Invalid Mode"}));
  }
});

//Sets Default Port and publishmode values
app.get('/setDefault/:ports/:mode/', function (req, res) {
  if(isValidMode(req.params.mode)){
    store.set('defaultPorts', req.params.ports);
    store.set('defaultMode', req.params.mode);
    store.save();
    res.send(JSON.stringify({defaultPorts: req.params.ports,defaultMode: req.params.mode}));
  }else{
    res.send(JSON.stringify({error: "Invalid Mode"}));
  }
});

//returns the status of the diode
app.get('/diode', function (req, res) {
  if(status == 0){
    res.send(JSON.stringify({status:status}));
  }else{
    res.send(JSON.stringify({status:status,pid:child.pid}));
  }
    
});

//stops diode
app.get('/diode/stop', function (req, res) {
    killDiodeCLI();
    res.send(JSON.stringify({status:status}));
});

//publishes diode on the specified ports
app.get('/diode/publish/:ports/:mode', function (req, res) {
  if(status == 0){
    let ports = req.params.ports.split(',');
    let mode = req.params.mode;
    let remoteAddress = "0x0";
    publishDiode(ports,mode,remoteAddress);
    res.send(JSON.stringify({status:status, result:1}));
  }else{
    res.send(JSON.stringify({status:status, result:0}));
  }
});
app.get('/diode/publish/:ports/:mode/:remoteAddress', function (req, res) {
    if(status == 0){
      let ports = req.params.ports.split(',');
      let mode = req.params.mode;
      let remoteAddress = req.params.remoteAddress;
      publishDiode(ports,mode,remoteAddress);
      res.send(JSON.stringify({status:status, result:1,pid:child.pid}));
    }else{
      res.send(JSON.stringify({status:status, result:0,pid:child.pid}));
    }
});

//Bind to specified ports on specified address
app.get('/diode/bind/:ports/:address', function (req, res) {
  if(status == 0){
    let ports = req.params.ports.split(',');
    let address = req.params.address;
    bindDiode(ports,address);
    res.send(JSON.stringify({status:status, result:1}));
  }else{
    res.send(JSON.stringify({status:status, result:0}));
  }
});

//Add BNS record
app.get('/diode/addBNS/:bnsName', function (req, res) {
  let bnsName = req.params.bnsName;
  if(isValidBNSName(bnsName)){
  addBNSRecord(bnsName);
  res.send(JSON.stringify({status:status, result:1}));
  }else{
    res.send(JSON.stringify({status:status, result:0, error: "Invalid BNS Name"}));
  }
}
);
app.listen(3000, function () {
    console.log('Diode is running on port 3000!');
});


//starts Diode with default ports and mode
function startDiodeCLI(){
  store.load();
  defaultPorts=store.get('defaultPorts').split(',');
  defaultMode=store.get('defaultMode');
  defaultRemoteAddr=store.get('defaultRemoteAddr');
  if(defaultPorts.length == 0){
    return false;
  }else{
    publishDiode(defaultPorts,defaultMode,defaultRemoteAddr);
  }
}

//Sets Diode Fleet
function setDiodeFleet(fleet){
  console.log("Setting Diode Fleet");
  let args = ['-retrytimes=1']
  args.push('-retrywait=1m')
  args.push('config')
  args.push('-set')
  args.push('fleet='+fleet)
  child = spawn( diodePath, args); 
  status = 3;
  console.log(child.pid);
  runningClients.push(child.pid);
  child.stdout.on( 'data', data => {
      console.log( `stdout: ${data}` );
  });
  child.stderr.on( 'data', data => {
      onError(data)
  });
  child.on('exit', (code) => {
    console.log(`child process exited with code ${code}`);
    runningClients.splice(runningClients.indexOf(child.pid),1);
      status = 0;
  });
}

//Checks if BNS name is valid by checking if it is longer than 8 characters
function isValidBNSName(bnsName){
  if(bnsName.length > 8){
    return true;
  }
  return false;
}

//Bind Diode to selected port and address
function bindDiode(ports,remoteAddress){
  console.log("Binding Diode");
  let args = ['-retrytimes=1']
  args.push('-retrywait=1m')
  args.push('-bind')
  ports.forEach(port => {
    args.push(port+":"+remoteAddress+":"+port)
  });
  child = spawn( diodePath, args); 
  console.log(child.pid);
  runningClients.push(child.pid);
  child.stdout.on( 'data', data => {
      console.log( `stdout: ${data}` );
  });
  child.stderr.on( 'data', data => {
      onError(data)
  });
  child.on('exit', (code) => {
    console.log(`child process exited with code ${code}`);
    runningClients.splice(runningClients.indexOf(child.pid),1);
      status = 0;
  });
}

//Publishes diode on the specified ports
function publishDiode(ports,mode,remoteAddress){
  console.log("Publishing diode on ports: " + ports);

    let args = ['-retrytimes=1']
    args.push('-retrywait=1m')
    args.push('publish')
    ports.forEach(port => {
      args.push('-'+mode)
      if(mode == 'private') args.push(port+','+remoteAddress)
      else args.push(port)
    });
    child = spawn( diodePath, args); 
    status = 3;
    console.log(child.pid);
    runningClients.push(child.pid);
    child.stdout.on( 'data', data => {
        console.log( `stdout: ${data}` );
    });
    child.stderr.on( 'data', data => {
        onError(data)
    });
    child.on('exit', (code) => {
      console.log(`child process exited with code ${code}`);
      runningClients.splice(runningClients.indexOf(child.pid),1);
        if(killVar){
          killVar=0;
          status = 0;
        }else{
          publishDiode(ports,mode,remoteAddress)
          status = 1;
          
        }

    });
}

//Add BNS record
function addBNSRecord(Name){
  console.log("Adding BNS Record");
  let args = ['-retrytimes=1']
  args.push('-retrywait=1m')
  args.push('bns')
  args.push('-register')
  args.push(Name)
  child = spawn( diodePath, args);
  status = 3;
  console.log(child.pid);
  runningClients.push(child.pid);
  child.stdout.on( 'data', data => {  
      console.log( `stdout: ${data}` );
  });
  child.stderr.on( 'data', data => {
      onError(data)
  }
  );
  child.on('exit', (code) => {
    console.log(`child process exited with code ${code}`);
    runningClients.splice(runningClients.indexOf(child.pid),1);
      status = 0;
  }
  );
}

function onError(data) {
  console.log( `stderr: ${data}` );
    
  if(data.indexOf("Bind")!=-1){
    status = 3;
  }else if(data.indexOf("Port")!=-1){
    status = 4;
  }else if(data.indexOf("windows")!=-1){
    getAddr();
  }else if(data.indexOf("Diode")!=-1){
    status = 1;
  }else if(data.indexOf("validated")!=-1){
    status = 2;
  }
}


//Checks if mode is valid
function isValidMode(mode){
  if(mode == 'private'||mode == 'public'||mode == 'protected'){
    return true;
  }else{
    return false;
  }
}

//Gets the address of the client
function getAddr(){

  let args = ['time']    
  child = spawn( diodePath, args); 
  status = 3;
  console.log(child.pid);
  runningClients.push(child.pid);
  child.stdout.on( 'data', data => {
      console.log( `stdout: ${data}` );
  });
  child.stderr.on( 'data', data => {
      onError(data)
      if(data.indexOf("Client address")!=-1){
        global.addrs = `${data.slice(data.indexOf("0x"),data.indexOf("0x")+42)}`;
        }
      if(data.indexOf("Client name")!=-1){
        global.domain = `${data.slice(data.indexOf(": ")+2,data.indexOf(".diode"))}`;
        console.log(global.domain);
      }
  });
  child.on('exit', (code) => {
    console.log(`child process exited with code ${code}`);
    runningClients.splice(runningClients.indexOf(child.pid),1);
    status = 0;
  });
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

store.load();
setTimeout(publishOnStart, 20000);

async function publishOnStart(){
  while(runningClients.length > 0){
    console.log("Waiting for clients to exit");
    await sleep(10000)
  }
  if(store.get('isPublishActive') == "true"){
    if(startDiodeCLI()){
      console.log("Diode started");
    }else{
      console.log("Diode failed to start");
    }
  }
}