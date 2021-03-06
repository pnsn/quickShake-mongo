//Connect to Earthworm waveserver to retrieve traceBuf2 packages for a given SCNL and time window 
//and stuff into mongodb 
//ALL EPOCH TIMES ARE MILLISECONDS!!!!

var Waveserver = require("../lib/waveserver.js"),
assert = require('assert');
var Scnl = require('../lib/scnl.js');


//get configs
var  scnls = [
            new Scnl({sta: 'OCP', chan: 'HNZ', net: 'UW', loc: '--'})
            //new Scnl({sta: 'BROK', chan: 'HNZ', net: 'UW', loc: '--'}),
            //new Scnl({sta: 'CORE', chan: 'HNZ', net: 'UW', loc: '--'})
           ];
    waveHost = "products01.ess.washington.edu"
    wavePort = 16021;



var daemon, start, stop;

daemon = true;
stop = Date.now()-1000;
start = stop - 1000; //1 second




var scnlIndex = 0;
// main function
function getData(scnl){
  console.log('getData called');
  if(scnl.lastBufStart === null){ //beginning of 
    scnl.lastBufStart = start;
  }
  if(daemon){
    var scnlStop = Date.now();
  }else{
    var scnlStop = scnl.lastBufStart + 5*1000; //move 5 seconds at a time for back filling
  }
  var ws = new Waveserver(waveHost, wavePort, scnl);
  ws.connect(scnl.lastBufStart, scnlStop);

  //parse getScnlRaw flag and decide whether to disconnect or continue
  ws.on('header', function(header){
    console.log("header")
    if (header.flag ==="FR"){ //most common error missed by current data not in ws yet
      ws.disconnect();
      console.log("Wave ERROR: FR (Current data not in Wave yet)");
    }else if(header.flag === 'FB'){
      console.log("Wave ERROR: there has been a terrible error of some sort or other.");
      ws.disconnect();
    }
  });

  ws.on('data', function(message){
    var scnl = findScnl(message); 
    if(message.starttime > scnl.lastBufStart){
      scnl.lastBufStart = message.starttime;
      // var json = JSON.stringify(message);
      var json = message
      console.log(json);
      console.log("from=" + message.sta + ":" + message.chan + ":" + message.net + ":" + message.loc + " length=" + 
                  message.data.length + " start=" + strToTime(message.starttime) + " end=" + strToTime(message.endtime));
    }
  });

  ws.on('error', function(error){
    console.log("Wave Error (closed): " + error); //error
  });
  
  //called when all data are processed or socket timesout
  ws.on("close", function(){
    if(daemon || scnl.lastBufStart && scnl.lastBufStart < stop){
      setTimeout(function(){
        scnlIndex ++;
        //toggle through index
        scnlIndex = scnlIndex == scnls.length ? 0 : scnlIndex;
        var scnl = scnls[scnlIndex];
        getData(scnl);
      }, 100);
    }else{
      if(db)
        db.close();
      process.exit(code=0);
    }
  });
} // end getData()

//the first call
var end = Date.now();
getData(scnls[0]);





/* FUNCTIONS */

//find channel object based on returned message
//needed to track each channels last start
function findScnl(msg){
  var scnl;
  for(var i=0; i < scnls.length; i++){
    var c = scnls[i];
    if(c.sta == msg.sta && c.chan == msg.chan && c.net == msg.net && c.loc == msg.loc){
     scnl = c;
     break;
    }
  }
  return scnl;
}


function strToTime(unix_timestamp) {
  var date = new Date(unix_timestamp);
  var year =  date.getFullYear();
  var month = "0" + date.getMonth() + 1;
  var day =  "0" + date.getDate();
  var hours = "0" + date.getHours();// hours part from the timestamp
  var minutes = "0" + date.getMinutes(); // minutes part from the timestamp
  var seconds = "0" + date.getSeconds(); // seconds part from the timestamp
  var ms = "0" + date.getMilliseconds(); // milliseconds part from the timestamp
  // will display time in 1/18/2015 10:30:23.354 format
  return  "/" + month.substr(minutes.length-2) + "/ " + day.substr(minutes.length-2) + "/" + year + " " + 
          hours.substr(minutes.length-2) + ':' + minutes.substr(minutes.length-2) + ':' + 
          seconds.substr(seconds.length-2) + '.' + ms.substr(ms.length-3);
}



function makeScnlKey(scnl){
  var loc = scnl.loc == "--" ? "" : "_" + scnl.loc;
  return  scnl.sta.toLowerCase() + "_" + scnl.chan.toLowerCase() + "_" + scnl.net.toLowerCase()  + loc ;
};



// prototype to return size of associative array
Object.size = function(obj) {
  var size = 0, key;
  for (key in obj) {
      if (obj.hasOwnProperty(key)) size++;
  }
  return size;
};
