// html elements
var video = document.getElementById('video-self');
var peerVideo = document.getElementById('video-peer');
var textarea = document.getElementById('textarea');
var output = document.getElementById('output');
var sendButton = document.getElementById('send-button');
var shareUrl = document.getElementById('share-url');
var urlInput = document.getElementById('url-input');

// connect to signaling server over socket.io.
// update ip address to where socket.io server is hosted on
var socket = io.connect('127.0.0.1:8973');

socket.on('connect', function() {
  console.log('connected to socket.io');
});

// wrapper for sending data over socket.io
function send (room, key, data) {
  console.log('send:', type, key, data);
  socket.emit('message', {type: type, room: room, key: key, data: data});
}
// wrapper to receive data from socket.io
function recv (room, type, cb) {
  console.log('recv:', type);
  socket.on(room + ':' + type, function(data) {
    console.log('recv cb:', type, data);
    if (data) cb(data);
  });
}

var room = location.hash.substr(1);
var type = 'answerer';
var otherType = 'offerer';

function id() {
  return (Math.random() * 1e+5) | 0;
}

// create a room if not exists, which makes us the offerer.
if (!room) {
  room = id();
  type = 'offerer';
  otherType = 'answerer';
  console.log('room created:', room);
  shareUrl.style.display = 'block';
  urlInput.value = window.location.href + '#' + room;
}

// which TURN or STUN servers to use,
// required to ensure most users can actually create a connection by avoiding restrictions in NAT and firewalls.
var server = {
  iceServers: [
    {url: 'stun:23.21.150.121'},
    {url: 'stun:stun.l.google.com:19302'},
    {url: 'turn:numb.viagenie.ca', credential: 'webrtcdemo', username: 'louis%40mozilla.com'}
  ]
};

var pcOptions = {
  optional: [
    {DtlsSrtpKeyAgreement: true}, // required for Chrome and Firefox to interoperate
    {RtpDataChannels: true} // required if we want to make use of DataChannels API on firefox
  ]
};

// PeerConnection is the starting point for creating connection with peer.
// accepts parameters about which servers to use, and type of connection
var pc = new RTCPeerConnection(server, pcOptions);

// this event will fire once the ICE framework has found some candidates that will allow you to connect with a peer.
// an ICE Candidate is an object that contains information on how to connect to a peer.
pc.onicecandidate = function(e) {
  if (e.candidate === null) return;
  // on chrome multiple candidate are usually found but we only need one.
  pc.onicecandidate = null;

  console.log('onicecandidate', e);

  // use signal channel to send the candidate to peer.
  send(room, "candidate:"+type, JSON.stringify(e.candidate));

  // request the other peers ICE candidate.
  recv(room, 'candidate:' + otherType, function(candidate) {
    console.log('recv candidate data:', candidate);
    pc.addIceCandidate(new RTCIceCandidate(JSON.parse(candidate)));
  });
};

var channel;

var mediaOptions = {
  video: true,
  audio: true
};

// getting camera video stream.
getUserMedia(mediaOptions, function (stream) {
  video.src = URL.createObjectURL(stream);

  // add the stream from getUserMedia to the PeerConnection,
  // so that other peers have access to our media stream.
  pc.addStream(stream);

  connect();
}, errorHandler);

// Executed when the connection has been setup and the other peer has added the stream to the peer connection with addStream. You need another <video> tag to display the other peer’s media.
pc.onaddstream = function(e) {
  peerVideo.src = URL.createObjectURL(e.stream);
};

// Options for the offer SDP.
var constraints = {
  mandatory: {
    OfferToReceiveAudio: true,
    OfferToReceiveVideo: true
  }
};


function errorHandler(error) {
  console.error(error);
}

function connect() {
  if (type === 'offerer') {

    console.log('creating channel.');

    var channelName = 'WEBRTC_DEMO';
    var channelOptions = {
      // unreliable: packets get their quickly, ex in game.
      // reliable: all packets must arrive, lost packets are resent, ex. file transfer.
      reliable: false
    };

    // The offerer should be the peer who creates the channel. The answerer will receive the channel in the callback ondatachannel on PeerConnection. You must call createDataChannel() once before creating the offer.
    channel = pc.createDataChannel(channelName, channelOptions);

    bindChannelEvents();

    console.log('creating offer.');
    // An Offer SDP (Session Description Protocol) is metadata that describes to the other peer the format to expect (video, formats, codecs, encryption, resolution, size, etc)
    // An exchange requires an offer from a peer, then the other peer must receive the offer and provide back an answer.
    pc.createOffer(function(offer) {
      pc.setLocalDescription(offer);

      // Once the offer has been generated we must set the local SDP to the new offer and send it through the signal channel to the other peer and await their Answer SDP.
      send(room, 'offer', JSON.stringify(offer));

      // wait for an answer SDP from signaling server
      recv(room, 'answer', function (answer) {
        pc.setRemoteDescription(
          new RTCSessionDescription(JSON.parse(answer))
        );
      });

    }, errorHandler, constraints);

  } else {

    // If you were the creator of the channel (meaning the offerer), you can bind events directly to the DataChannel you created with createChannel. If you are the answerer, you must use the ondatachannel callback on PeerConnection to access the same channel.
    pc.ondatachannel = function(e) {
      channel = e.channel;

      bindChannelEvents();
    };

    // notify that we want to join room
    send(room, 'join');

    // answerer needs to wait for an offer before
    // generating the answer SDP
    recv(room, 'offer', function (offer) {
      pc.setRemoteDescription(
        new RTCSessionDescription(JSON.parse(offer))
      );

      // An Answer SDP is just like an offer but a response; sort of like answering the phone. We can only generate an answer once we have received an offer.
      pc.createAnswer(function (answer) {
        pc.setLocalDescription(answer);

        // send it to signaling server
        send(room, 'answer', JSON.stringify(answer));
      }, errorHandler, constraints);
    });

  }

  function bindChannelEvents() {
    // when channel connection is established
    channel.onopen = function() {
      console.log('channel connection established.');
    };

    channel.onerror = function(error) {
      console.error('channel error:', error);
    };

    // onmessage callback gets invoke on new data,
    // event object contains data and meta data such as time
    channel.onmessage = function(e) {
      console.log('Got message: ' + e.data);
      var textNode = document.createTextNode(Date.now() + ': ' + e.data);
      var div = document.createElement('div');
      div.appendChild(textNode);
      output.appendChild(div);
    };

    // when peer closes the connection
    channel.onclose = function() {
      console.log('channel closed');
    };

    // close the channel once the connection should end. It is recommended to do this on page unload.
    window.onbeforeunload = function() {
      channel.close();
    };
  }

  sendButton.onclick = function() {
    console.log('send button clicked.');
    // can only send data once it's open
    if (channel.readyState === 'open') {
      var value = textarea.value;
      console.log('data to send:', value);
      // String, Blob, ArrayBuffer or ArrayBufferView, so be sure to stringify objects.
      channel.send(value);
    }
  }
}
