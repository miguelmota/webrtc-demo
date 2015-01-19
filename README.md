# WebRTC demo

In this demo we connect to a peer using [RTCPeerConnection](https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection) and share a media stream accessed via [https://developer.mozilla.org/en-US/docs/NavigatorUserMedia.getUserMedia](getUserMedia). We can also send arbriary data to the peer using [RTCDataChannel](https://developer.mozilla.org/en-US/docs/Web/API/RTCDataChannel). In order to keep track and send the [ICECandidate](https://developer.mozilla.org/en-US/docs/Web/Events/icecandidate)s to the peers, we have a simple [Node.js](http://nodejs.org/) server set up with [socket.io](http://socket.io/) as the signaling mechanism between the peer connections.

# Demo

[http://lab.moogs.io/webrtc-demo](http://lab.moogs.io/webrtc-demo)

# Usage

```bash
node server/server.js
```

```bash
cd client/

python -m SimpleHTTPServer 9999
```

Navigate to demo at `http://localhost:9999`

# License

MIT
