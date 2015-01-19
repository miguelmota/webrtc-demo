var http = require('http');
var express = require('express');
var app  = express();

app.use(function (req, res, next) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
  res.setHeader('Access-Control-Allow-Credentials', true);
  next();
});

var server = http.Server(app);

var rooms = {};

var io = require('socket.io')(server);
io.sockets.on('connection', function (socket){
  console.log('connected');

  socket.on('message', function (data) {
    var type = data.type;
    var room = data.room;
    var key = data.key;
    var offer, answer, candidate, offererCandidate;

    if (type === 'offerer') {
      if (key === 'offer') {
        offer = data.data;
        console.log('Got offer: ', offer);
        rooms[room] = {
          offer: offer,
          key: key
        };
        console.log('Storing offer:', rooms[room]);
        socket.emit(room + ':offer', offer);
      }

      if (key === 'candidate:offerer') {
        candidate = data.data;
        rooms[room].candidate = candidate;
        console.log('broadcasting candidate', candidate);
        socket.emit(room + ':candidate:answerer', candidate);
      }
    } else if (type === 'answerer') {
      if (key === 'join') {
        offer = rooms[room].offer;
        console.log('emitting offer', offer);
        socket.emit(room + ':offer', offer);
      }

      if (key === 'answer') {
        answer = data.data;
        console.log('broadcasting answer', answer);
        socket.broadcast.emit(room + ':answer', answer);
      }

      if (key === 'candidate:answerer') {
        candidate = data.data;
        offererCandidate = rooms[room].candidate;
        console.log('broadcasting candidate', candidate);
        socket.broadcast.emit(room + ':candidate:answerer', candidate);
        socket.emit(room + ':candidate:offerer', offererCandidate);
      }
    }
  });
});


server.listen(8973);
