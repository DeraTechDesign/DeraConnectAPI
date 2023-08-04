var Service = require("node-windows").Service;
const path = require("path");

var svc = new Service({
  name: "DeraConnect",
  description: "DeraConnect",
  script: path.join(process.cwd(), "deraCLI.js"),
});

svc.uninstall();
