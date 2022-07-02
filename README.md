
# DeraConnect Windows API Service

This is a Windows service with an API for Diode CLI. It runs on background as a service. You can use Diode CLI throught the API and can run Publish on Windows startup. 

This can be used for App development with Diode. 



## API Usage

#### Get address and domain of the client

```http
  GET /diode/address
```

#### Set Diode Fleet

```http
  GET /diode/fleet/:fleet
```

| Parameter | Type     | Description                |
| :-------- | :------- | :------------------------- |
| `fleet` | `string` | **Required**. Fleet Address. |

#### Set Publish on Startup Flag

```http
  GET /setPublishActive/:value
```

| Parameter | Type     | Description                |
| :-------- | :------- | :------------------------- |
| `value` | `Bool` | **Required**. Service publishes Diode automatically on Windows startup if set True. |

#### Set Default Port, publish mode and remote address values

```http
  GET /setDefault/:ports/:mode/:remoteAddr
```
| Parameter | Type     | Description                |
| :-------- | :------- | :------------------------- |
| `ports` | `String` | **Required**. Default ports to publish. Format: innerPort:outerPort, secondport. Ex.: 8080:80,3000:4200 |
| `mode` | `Bool` | **Required**. Publish mode. Private Public or Protected |
| `remoteAddr` | `Bool` | Remote address for Private mode |

#### Get the current status of the DiodeCLI

```http
  GET /diode
```

#### Stop DiodeCLI
```http
  GET /diode/stop
```

#### Publish Diode on the specified ports
```http
  GET /diode/:ports/:mode/:remoteAddress
```
| Parameter | Type     | Description                |
| :-------- | :------- | :------------------------- |
| `ports` | `String` | **Required**. Ports to publish. Format: innerPort:outerPort, secondPort. Ex.: 8080:80,3000:4200 |
| `mode` | `Bool` | **Required**. Publish mode. Private Public or Protected |
| `remoteAddr` | `Bool` | Remote address for Private mode |

#### Bind Diode to specified ports on 
```http
  GET /diode/bind/:ports/:address
```
| Parameter | Type     | Description                |
| :-------- | :------- | :------------------------- |
| `ports` | `String` | **Required**. Ports to publish. Format: innerPort:outerPort, secondPort. Ex.: 8080:80,3000:4200 |
| `remoteAddr` | `Bool` |  **Required**. Remote address|

#### Add BNS record
```http
  GET /diode/addBNS/:bnsName
```
| Parameter | Type     | Description                |
| :-------- | :------- | :------------------------- |
| `bnsName` | `String` | **Required**. BNS name to record. Must be longer than 8 caracters. |

## Installation

You can use Node to build and install the service. 

```bash 
  npm install -g node-windows@1.0.0-beta.6 
  npm link node-windows
  npm install app-root-dir
  npm install express
  
  node .\main.js
```
    