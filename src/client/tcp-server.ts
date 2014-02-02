/*
  This is a TCP server based on Freedom's sockets API.

  Based on:
    https://github.com/GoogleChrome/chrome-app-samples/tree/master/tcpserver
*/

/**
 * Converts an array buffer to a string of hex codes and interpretations as
 * a char code.
 *
 * @param {ArrayBuffer} buf The buffer to convert.
 */
function getHexStringOfArrayBuffer(buf) {
  var uInt8Buf = new Uint8Array(buf);
  var a = [];
  for (var i = 0; i < buf.byteLength; ++i) {
    a.push(uInt8Buf[i].toString(16));
  }
  return a.join('.');
}

/**
 * Converts an array buffer to a string of hex codes and interpretations as
 * a char code.
 *
 * @param {ArrayBuffer} buf The buffer to convert.
 */
function getStringOfArrayBuffer(buf) {
  var uInt8Buf = new Uint8Array(buf);
  var s = '';
  for (var i = 0; i < buf.byteLength; ++i) {
    s += String.fromCharCode(uInt8Buf[i]);
  }
  return s;
}


module TCP {

  var DEFAULT_MAX_CONNECTIONS = 1048576;

  // Define some local variables here.
  // TODO: throw an Error if this isn't here.
  var FSocket = freedom['core.socket']();

  /**
   * TCP.Server
   *
   * Aside: see http://developer.chrome.com/trunk/apps/socket.html#method-getNetworkList
   * @param {Object} options Options of the form { maxConnections: integer,
   * allowHalfOpen: bool }.
   * @param {function} connect_callback Called when socket is connected.
   */
  export class Server {

    // TODO: finish typing these members
    maxConnections:number;
    callbacks:any;
    connectionCallbacks:any;
    openConnections:any;
    serverSocketId:number;

    constructor(public addr, public port, options?) {
      this.maxConnections = typeof(options) != 'undefined' &&
          options.maxConnections || DEFAULT_MAX_CONNECTIONS;

      // Callback functions.
      this.callbacks = {
        listening: null,  // Called when server starts listening for connections.
        connection: null, // Called when a new socket connection happens.
        disconnect: null, // Called when server stops listening for connections.
        // Called when a socket is closed from the other side.  Passed socketId as an arg.
        socketRemotelyClosed: null
      };

      // Default callbacks for when we create new Connections.
      this.connectionCallbacks = {
        disconnect: null, // Called when a socket is closed
        recv: null,       // Called when server receives data.
        sent: null,       // Called when server has sent data.
        // TCP.Connection creation and removal callbacks.
        created: this._addToServer,
        removed: this._removeFromServer
      };

      this.openConnections = {};  // Open sockets.
      // Server socket (accepts and opens one socket per client)
      this.serverSocketId = null;
    }

    /** Open a socket to listen for TCP requests. */
    public listen() {
      FSocket.create('tcp', {}).done(this._onCreate.bind(this));
      console.log('Tcp server listening...');
    }

    /** Disconnect all sockets and stops listening. */
    public disconnect() {
      if (this.serverSocketId) {
        console.log('Server: disconnecting server socket ' + this.serverSocketId);
        FSocket.disconnect(this.serverSocketId);
        FSocket.destroy(this.serverSocketId);
      }
      for (var i in this.openConnections) {
        try {
          this.openConnections[i].disconnect();
          this._removeFromServer(this.openConnections[i]);
        } catch (ex) {
          console.warn(ex);
        }
      }
      this.serverSocketId = 0;
      // this.isListening = false;
      this.callbacks.disconnect && this.callbacks.disconnect();
    }

    /**
     * Called when a new tcp connection
     */
    private _addToServer = (tcpConnection) => {
      // console.log("adding connection " + tcpConnection.socketId + " to server.");
      this.openConnections[tcpConnection.socketId] = tcpConnection;
    }

    /**
     * This is never called.
     */
    private _removeFromServer = (tcpConnection) => {
      // console.log("removing connection " + tcpConnection.socketId + " from server");
      delete this.openConnections[tcpConnection.socketId];
    }

    isConnected() { return this.serverSocketId > 0; }

    /**
     * Set an event handler. See http://developer.chrome.com/trunk/apps/socket.
     * html for more about the events than can happen.
     *
     * 'listening' takes TODO: complete.
     */
    public on(eventName, callback) {
      if (eventName in this.callbacks) {
        this.callbacks[eventName] = callback;
      } else {
        console.error('Server: on failed for ' + eventName);
      }
    }

    /**
     * Callback upon creation of a socket. If socket was successfully created,
     * begin listening for incoming connections.
     */
    private _onCreate(createInfo) {
      console.log('Creating socket... ', createInfo);
      this.serverSocketId = createInfo.socketId;
      if (this.serverSocketId > 0) {
        console.log(JSON.stringify([this.serverSocketId, this.addr, this.port]));
        FSocket.listen(this.serverSocketId, this.addr, this.port)
          .done(this._onListenComplete.bind(this));
        // this.isListening = true;
      } else {
        console.error('Server: create socket failed for ' + this.addr + ':' +
            this.port);
      }
    }

    /**
     * Callback upon having heard the remote side. If connection was
     * successful, then accept and open a new socket.
     */
    private _onListenComplete(resultCode) {
      if (0 === resultCode) {
        FSocket.on('onConnection', this._accept);
        FSocket.on('onDisconnect', this._disconnect.bind);
        // Start the listening callback if it exists.
        this.callbacks.listening && this.callbacks.listening();
      } else {
        console.error('Server: listen failed for ' + this.addr + ':' +
            this.port + '. Resultcode=' + resultCode);
      }
    }

    /** Accept a connection. */
    private _accept = (acceptValue) => {
      if (this.serverSocketId !== acceptValue.serverSocketId) {
        console.warn('Connected to unexpected socket ID: ',
                     this.serverSocketId);
        return;
      }
      var connectionsCount = Object.keys(this.openConnections).length;
      if (connectionsCount >= this.maxConnections) {
        FSocket.disconnect(acceptValue.clientSocketId);
        FSocket.destroy(acceptValue.clientSocketId);
        console.warn('Server: too many connections: ' + connectionsCount);
        return;
      }
      this._createConnection(acceptValue.clientSocketId);
    }

    private _disconnect = (socketInfo) => {
      console.log('connection ' + socketInfo.socketId + ' remotely disconnected.');
      var disconnect_cb = this.openConnections[socketInfo.socketId].callbacks.disconnect;
      disconnect_cb && disconnect_cb(socketInfo.socketId);
      this.openConnections[socketInfo.socketId].disconnect();
      this._removeFromServer(socketInfo);
    }

    private _createConnection(socketId) {
      new Connection(socketId, this.callbacks.connection,
            this.connectionCallbacks);
    }

  }  // class TCP.Server


  /**
   * TCP.Connection - Holds a TCP connection to a client
   *
   * @param {number} socketId The ID of the server<->client socket.
   * @param {Server.callbacks.connection}  serverConnectionCallback
   *    Called when the new TCP connection is formed and initialized,
   *    passing itself as a parameter.
   * @param {Server.connectionCallbacks} callbacks
   */
  class Connection {

    socketInfo:any = null;
    isConnected:boolean = false;
    pendingReadBuffer:any;
    recvOptions:any;
    pendingRead;
    // Right now this is only false until the socket has all the information a
    // user might need (ie socketInfo). The socket shouldn't be doing work for
    // the user until the internals are ready.
    _initialized:boolean = false;

    constructor(
        public socketId,
        public serverConnectionCallback,
        public callbacks) {

      this.callbacks.recv = callbacks.recv;
      this.callbacks.disconnect = callbacks.disconnect;
      this.callbacks.sent = callbacks.sent;
      this.callbacks.created = callbacks.created;
      this.callbacks.removed = callbacks.removed;
      this.isConnected = true;
      this.pendingReadBuffer = null;
      this.recvOptions = null;
      this.pendingRead = false;
      this.callbacks.created(this);

      FSocket.on('onData', this._onRead);
      FSocket.getInfo(socketId).done(function(socketInfo) {
        this.socketInfo = socketInfo;
        this._initialized = true;

        // Connection has been established, so make the connection callback.
        //console.log('Server: client connected, socketInfo=' +
        //    JSON.stringify(socketInfo));
        if (serverConnectionCallback) {
          serverConnectionCallback(this);
        }
      }.bind(this));
    }

    /**
     * Set an event handler. See http://developer.chrome.com/trunk/apps/socket.
     * html for more about the events than can happen.
     *
     * When 'recv' callback is null, data is buffered and given to next non-null
     * callback.
     *
     * @param {string} eventName Enumerated instance of valid callback.
     * @param {function} callback Callback function.
     */
    private on(eventName, callback, options) {
      if (eventName in this.callbacks) {
        this.callbacks[eventName] = callback;
        // For receiving, if recv is set to null at some point, we may end up with
        // data in pendingReadBuffer which when it is set to something else,
        // makes the callback with the pending data, and then re-starts reading.
        if(eventName == 'recv' && callback) {
          if(options) { this.recvOptions = options; }
          else { this.recvOptions = null; }

          if (this.pendingReadBuffer) {
            /*console.log('Connection(' + this.socketId + '):' +
                ' calling recv from "on".'); */
            this._bufferedCallRecv();
          }
        }
      } else {
        console.error('Connection(' + this.socketId + '):' +
            'no such event for on: ' + eventName + ".  Available keys are " +
                JSON.stringify({available_keys: Object.keys(this.callbacks)}));
      }
    }

    /**
     *
     */
    private _bufferedCallRecv = () => {
      if(this.recvOptions && this.recvOptions.minByteLength &&
          this.recvOptions.minByteLength > this.pendingReadBuffer.byteLength) return;
      // console.log("Sending " + this.pendingReadBuffer.byteLength + " bytes to the callback");
      var tmpBuf = this.pendingReadBuffer;
      this.pendingReadBuffer = null;
      this.callbacks.recv(tmpBuf);
    }

    /**
     * Sends a message down the wire to the remote side
     *
     * @see http://developer.chrome.com/trunk/apps/socket.html#method-write
     * @param {String} msg The message to send.
     * @param {Function} callback The function to call when the message has sent.
     */
    private send(msg, callback) {
      // Register sent callback.
      if ((typeof msg) != "string") {
        console.log("Connection.send: got non-string object.");
      }
      _stringToArrayBuffer(msg + '\n', function(msg) {
        // TODO: need bind?
        this.sendRaw(msg, callback);
      }.bind(this));
    }

    /**
     * Sends a message pre-formatted into an arrayBuffer.
     */
    public sendRaw(msg, callback) {
      if(!this.isConnected) {
        console.warn('Connection(' + this.socketId + '):' +
            ' sendRaw when disconnected.');
        return;
      }
      var realCallback = callback || this.callbacks.sent || function() {};
      FSocket.write(this.socketId, msg).done(realCallback);
    }

    /** Disconnects from the remote side. */
    private disconnect() {
      if(!this.isConnected) return;
      this.isConnected = false;
      // Temporarily remember disconnect callback.
      var disconnectCallback = this.callbacks.disconnect;
      // Remove all callbacks.
      this.callbacks.disconnect = null;
      this.callbacks.recv = null;
      this.callbacks.sent = null;
      // Close the socket.
      FSocket.disconnect(this.socketId);
      FSocket.destroy(this.socketId);
      // Make disconnect callback if not null
      disconnectCallback && disconnectCallback(this);
      // Fire removal callback for the Server containing this callback.
      this.callbacks.removed(this);
    }

    private _addPendingData(buffer) {
      if (!this.pendingReadBuffer) {
        this.pendingReadBuffer = buffer;
      } else {
        var temp = Uint8Array(this.pendingReadBuffer.byteLength +
                              buffer.byteLength);
        temp.set(new Uint8Array(this.pendingReadBuffer), 0);
        temp.set(new Uint8Array(buffer), this.pendingReadBuffer.byteLength);
        this.pendingReadBuffer = temp.buffer;
      }
    }

    /**
     * Callback function for when data has been read from the socket.
     * Converts the array buffer that is read in to a string
     * and sends it on for further processing by passing it to
     * the previously assigned callback function.
     * See freedom core.socket onData event.
     */
    private _onRead = (readInfo) => {
      if (readInfo.socketId !== this.socketId) {
        console.warn('onRead: received data for the wrong socketId: ',
                     this.socketId);
        return;
      } /*else {
        console.log('onRead: found.');
      }*/
      if (this.callbacks.recv && this._initialized) {
        this._addPendingData(readInfo.data);
        this._bufferedCallRecv();
      } else {
        // If we are not receiving data at the moment, we store the received
        // data in a pendingReadBuffer for the next time this.callbacks.recv is
        // turned on.
        this._addPendingData(readInfo.data);
        this.pendingRead = false;
      }
    }

    /** Callback for when data has been successfully written to socket. */
    private _onWriteComplete = (writeInfo) => {
      if (this.callbacks.sent) {
        this.callbacks.sent(writeInfo);
      }
    }

    /** Output the state of this connection */
    private state = () => {
      return {
        socketId: this.socketId,
        socketInfo: this.socketInfo,
        callbacks: this.callbacks,
        isConnected: this.isConnected,
        pendingReadBuffer: this.pendingReadBuffer,
        recvOptions: this.recvOptions,
        pendingRead: this.pendingRead
      };
    }

  }  // class TCP.Connection


  /**
   * Converts an array buffer to a string
   *
   * @private
   * @param {ArrayBuffer} buf The buffer to convert.
   * @param {Function} callback The function to call when conversion is
   * complete.
   */
  function _arrayBufferToString(buf, callback) {
    var bb = new Blob([new Uint8Array(buf)]);
    var f = new FileReader();
    f.onload = function(e) {
      callback(e.target.result);
    };
    f.readAsText(bb);
  }

  /**
   * Converts a string to an array buffer
   *
   * @private
   * @param {String} str The string to convert.
   * @param {Function} callback The function to call when conversion is
   * complete.
   */
  function _stringToArrayBuffer(str, callback) {
    var bb = new Blob([str]);
    var f = new FileReader();
    f.onload = function(e) {
        callback(e.target.result);
    };
    f.readAsArrayBuffer(bb);
  }

}  // module TCP
