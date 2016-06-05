/*
  index.js

  This file contains the logic that drives the app.

*/

// create the app object
var app = {};

// current heart rate
app.heartRate = 0;
// for drawing a graph
app.dataPoints = [];

app.connected = false;

app.peripheral = {};

app.initialize = function() {
  this.bindEvents();
};

app.bindEvents = function() {
  document.addEventListener('deviceready', this.onDeviceReady, false);
};

app.onDeviceReady = function() {
  app.status("Click to connect.");
};

app.scan = function() {
  app.status("Scanning for Heart Rate Monitor");

  // hanlder for scan success
  function onScan(peripheral) {

    // assume only one peripheral sending heart rate

    console.log("Found " + JSON.stringify(peripheral));
    app.status("Found " + peripheral.name);

    // save peripheral
    app.peripheral = peripheral;

    // on successful connection
    function onConnect(peripheral) {
      app.status("Connected to " + peripheral.name);
      // start heart rate notification
      ble.startNotification(peripheral.id, '180D', '2A37', app.onData, app.onError);
      // set flag
      app.connected = true;
    }

    // on connection failure
    function onFailure (reason) {
      beatsPerMinute.innerHTML = "...";
      console.log("disconnected: " + reason);
      app.status("Disconnected!");
      app.connected = false;
      $('#button-connect').html('CONNECT');
    }

    // connect to peripheral
    ble.connect(peripheral.id, onConnect, onFailure);

    // set button text
    $('#button-connect').html('DISCONNECT');
  }

  // handler for scan failure
  function scanFailure(reason) {
    app.status("Did not find a heart rate monitor.");
    $('#button-connect').html('CONNECT');
  }

  // scan for heartrate service, 0x180D
  // https://developer.bluetooth.org/gatt/services/Pages/ServiceViewer.aspx?u=org.bluetooth.service.heart_rate.xml
  ble.scan(['180D'], 5, onScan, scanFailure);
};


// called on receiving characteristic data
app.onData = function(buffer) {

  var hrm = new Uint8Array(buffer);

  // parse heart rate
  // see:
  // https://developer.bluetooth.org/gatt/characteristics/Pages/CharacteristicViewer.aspx?u=org.bluetooth.characteristic.heart_rate_measurement.xml

  if(hrm[0] & 0x1) {
    // 16-bit
    app.heartRate = (hrm[2] << 8) + hrm[1];
  }
  else {
    // 8-bit
    app.heartRate = hrm[1];
  }

  // set heart rate display
  beatsPerMinute.innerHTML = app.heartRate;

  // draw graph
  app.plot(app.heartRate);
};

// called on notifcation error
app.onError = function(reason) {
  alert("There was an error " + reason);
};

// set messages
app.status = function(message) {
  console.log(message);
  statusDiv.innerHTML = message;
};

// draw a simple graph
// adapted from evothings.com example
app.plot = function(heartRate) {

  var canvas = document.getElementById('canvas');
  var context = canvas.getContext('2d');
  var dataPoints = app.dataPoints;
  var maxLen = 50;

  // add data
  dataPoints.push(heartRate);
  // cap length
  if (dataPoints.length > maxLen) {
    // remove first
    dataPoints.splice(0, 1);
  }

  // maximum value
  var maxVal = 400;

  function drawPoints(color)
  {
    // draw dots
    context.fillStyle = color;
    context.strokeStyle = color;
    var x = 0;
    for (var i = dataPoints.length-1; i> 0; i--) {
      context.beginPath();
      var y = canvas.height - (dataPoints[i] * canvas.height) / maxVal;
      context.arc(x, y, 4, 0, 2 * Math.PI);
      context.fill();
      x += 10;
    }
  }

  // clear previous
  context.clearRect(0, 0, canvas.width, canvas.height);

  drawPoints("green");
};


/**
 * Called when HTML page has been loaded.
 */
$(document).ready( function()
{
  // canvas resize callback
  resizeCanvas = function () {
    var canvas = $('#canvas');
    var container = $(canvas).parent();
    canvas.attr('width', $(container).width() ); // Max width
  };

  // Adjust canvas size when browser resizes
  $(window).resize( resizeCanvas );

  // Adjust the canvas size when the document has loaded.
  resizeCanvas();

  // AJAX callback
  function onDataReceived(jsonData) {
    app.status("Thingspeak post: " + JSON.stringify(jsonData));
  }
  // AJAX error handler
  function onError(){
    app.status("Ajax error!");
  }

  // get data from server
  function getData() {
    if(app.connected) {
      // prepare thingspeak URL
      // set up a thingspeak channel and change the write key below
      var key = 'IKYH9WWZLG5TVYF2'
      var urlTS = 'https://api.thingspeak.com/update?api_key=' + key + '&field1=' + app.heartRate;
      // make the AJAX call
      $.ajax({
        url: urlTS,
        type: "GET",
        dataType: "json",
        success: onDataReceived,
        error: onError
      });
    }
  }
  // define an update function
  var count = 0;
  function update() {
    // get data
    getData();
    // set timeout - thingspeak can only update every 15 seconds
    setTimeout(update, 16000);
  }
     // call update
  update();

});

// handler for connect button
app.connectBtn = function()
{
  if (!app.connected)
  {
    app.scan();

    $('#button-connect').html('SCANNING');
  }
  else
  {

    ble.disconnect(app.peripheral.id,
      // on disconnect
      function() {
        console.log("disconnected.");
        // set button text
        $('#button-connect').html('CONNECT');
        // set flag
        app.connected = false;
        // set message
        app.status("Disconnected.");
      },
      // on error
      function(reason) {
        console.log("disconnect error: " + reason);
      });
  }
};

// initialize the application
app.initialize();
