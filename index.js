'use strict';

var os = require('os');
var nodeStatic = require('node-static');
//var http = require('http');
var socketIO = require('socket.io');
const https = require('https');
const fs  = require('fs');
const upload = require('./config/multer');
var express = require('express');
var app = express();
var port = 3000;
const options = {
  key : fs.readFileSync('./private.pem'),
  cert: fs.readFileSync('./public.pem')
};

var fileServer = new(nodeStatic.Server)();
// var server = https.createServer(options, function(req, res) {
//   fileServer.serve(req, res);
// });
var server = https.createServer(options, app);

app.get('/', (request, response) => {
  fs.readFile('HTMLPage.html', (error, data) => {
    response.writeHead(200, { 'Content-Type': 'text/html' });
    response.end(data);
  });
});

app.get('/connect', (request, response) => {
  fs.readFile('index.html', (error, data) => {
    response.writeHead(200, { 'Content-Type': 'text/html' });
    response.end(data);
  });
});

server.listen(3000, () => {
  console.log(`Server Running at ${port}`);
});

var io = socketIO.listen(app);
io.sockets.on('connection', function(socket) {

  // convenience function to log server messages on the client
  function log() {
    var array = ['Message from server:'];
    array.push.apply(array, arguments);
    socket.emit('log', array);
  }

  socket.on('message', function(message) {
    log('Client said: ', message);
    
    //message가 bye이면 채팅방(foo)을 비우는(leave) 코드를 추가한 것이다. 즉, 화상 채팅 중에 한 사람이라도 채팅방을 나가면(bye) 채팅방을 비우도록 한 것이다.
    if (message==="bye" && socket.rooms['foo']) {
      io.of('/').in('foo').clients((error, socketIds) => {
          if (error) throw error;

          socketIds.forEach(socketId => {
              io.sockets.sockets[socketId].leave('foo');
          });
      });
    }

    // for a real app, would be room-only (not broadcast)
    socket.broadcast.emit('message', message);
  });

  // create or join 메시지시 파라미터(room)에 채팅방 이름이(foo)이 같이 전송되어 온다.
  // 해당 채팅방의 정보(clientsInRoom) 중에서 사용자 수가 0명이면 (numClients === 0),
  // 해당 접속자(socket)를 지정된 채팅방(room)의 생성자로 참여(join)시키고,
  // 해당 접속자에게 created란 메시지를 전달한다(emit).
  // 해당 접속자는 메시지를 수신하면 방 생성자 또는 방장 등의 의미를 가지도록 설정한다.
  // 다시 다른 사용자가 접속하면 접속자수는 현재 1이기 때문에 (numClients === 1),
  // 해당 접속자에게 joined란 메시지와 이제 화상 채팅을 실행할 준비를(ready) 하라고 메시지를 전달한다(emit).
  socket.on('create or join', function(room) {
    log('Received request to create or join room ' + room);

    var clientsInRoom = io.sockets.adapter.rooms[room];
    var numClients = clientsInRoom ? Object.keys(clientsInRoom.sockets).length : 0;
    log('Room ' + room + ' now has ' + numClients + ' client(s)');

    if (numClients === 0) {
      socket.join(room);
      log('Client ID ' + socket.id + ' created room ' + room);
      socket.emit('created', room, socket.id);

      // 첫 사용자가 입장하면 채팅방을 생성한다는 의미로 created,
      console.log('created');
    } else if (numClients === 1) {
      log('Client ID ' + socket.id + ' joined room ' + room);
      io.sockets.in(room).emit('join', room);
      socket.join(room);
      socket.emit('joined', room, socket.id);
      io.sockets.in(room).emit('ready');

      //두번째 사용자가 입장했다는 의미로 joined를 콘솔창에 출력하도록 한다.
      console.log('joined');
    } else { // max two clients
      socket.emit('full', room);
    }
  });

  socket.on('ipaddr', function() {
    var ifaces = os.networkInterfaces();
    for (var dev in ifaces) {
      ifaces[dev].forEach(function(details) {
        if (details.family === 'IPv4' && details.address !== '127.0.0.1') {
          socket.emit('ipaddr', details.address);
        }
      });
    }
  });

  socket.on('bye', function(){
    console.log('received bye');
  });

});
