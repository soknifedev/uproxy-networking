/// <reference path='../../node_modules/freedom-typescript-api/interfaces/udp-socket.d.ts' />
/// <reference path='../../node_modules/freedom-typescript-api/interfaces/promise.d.ts' />
module Socks {
  import UdpSocket = freedom.UdpSocket;

  /**
   * A UDP-based "relay" server intended for use as part of a SOCKS5 proxy:
   *   http://www.ietf.org/rfc/rfc1928.txt
   *
   * Briefly, here's how to use this:
   *  - create an instance of this class
   *  - call bind (you probably want to specify port zero to have the system
   *    pick a free port)
   *  - call getInfo, to discover on which port the relay is listening
   *  - (the caller can now return the address and port back to the SOCKS
  *     client)
   *  - this class will forward a copy of each datagram received on the socket
   *    to the relevant remote host; the datagrams are assumed to be prepended
   *    the SOCKS5 headers (see section 7 of the RFC), which will be stripped
   *    before forwarding to the remote host (if those headers are not found
   *    then the datagram will be ignored, as per the RFC)
   *  - this class will relay each datagram reply received from the remote
   *    server *back* to the SOCKS5 client; the reply will be prepended with
   *    the SOCKS5 header receive in the previous step
   *  - call destroy to clean up, typically when the TCP connection on which
   *    the UDP_ASSOCIATE was negotiated is terminated (this is important
   *    because relays are relatively expensive in terms of the number of
   *    sockets required: one to communicate with the SOCKS5 client and one
   *    for each remote host with which it wishes to communicate)
   *
   * One relay should be created in response to each UDP_ASSOCIATE command.
   *
   * ===
   * This is a work in progress so please beware that right now this
   * relay...isn't. That is, it doesn't actually forward packets: there's
   * a bunch of utility methods in Socks which, appropriarely refactored, will
   * greatly help with that, e.g. interpretSocksRequest could also decode the
   * datagram headers. What this *is* useful for right now is verifying that
   * the server correctly informs the SOCKS5 client *where* to send UDP packets
   * and then it's fun to watch the client futilely sending its UDP packets into
   * the ether...never to return.
   * ===
   * 
   * Other notes:
   *  - while the RFC states that the relay MUST drop any message originating
   *    from an IP other than that which requested the association, this
   *    implementation makes no effort to do so (this isn't urgent because we
   *    typically only listen locally)
   *  - similarly, we make no effort to respect the DST.PORT and DST.ADDR fields
   *    specified by the client during the handshake: having run various proxy
   *    clients it seems that these are rarely specified anyway (which is fine
   *    according to section 6 of the RFC)
   *    and, in any case, we are typically only listening locally
   *  - we make no attempt to implement fragmentation (see section 7 of the
   *    RFC)
   */
  export class UdpRelay {

    // The Socks client sends datagrams to this socket.
    // Eventually, it will also receive replies on this socket.
    private socket:UdpSocket;

    // Address and port to which the "client-side" socket is bound.
    private address:string;
    private port:number;

    constructor () {
      this.socket = freedom['core.udpsocket']();
    }

    /**
     * Returns a promise to create a socket, bind to the specified address and
     * port, and start relaying events. Specify port zero to have the system
     * choose a free port.
     */
    public bind(address:string, port:number) : Promise<void> {
      return this.socket.bind(address, port)
          .then((resultCode:number) => {
            // Ensure the listen was successful.
            if (resultCode != 0) {
              return Promise.reject(new Error('listen failed on ' +
                  this.address + ':' + this.port +
                  ' with result code ' + resultCode));
            }
            return Promise.resolve(resultCode);
          })
          .then(this.socket.getInfo)
          .then((socketInfo:UdpSocket.SocketInfo) => {
            // Record the address and port on which our socket is listening.
            this.address = socketInfo.localAddress;
            this.port = socketInfo.localPort;
            dbg('listening on ' + this.address + ':' + this.port);
          })
          .then(this.attachSocketHandler);
    }

    /**
     * Listens for onData events.
     * The socket must be bound.
     */
    private attachSocketHandler = () => {
      this.socket.on('onData', this.onSocksClientData);
    }

    private onSocksClientData = (recvFromInfo:UdpSocket.RecvFromInfo) => {
      var request:Socks.UdpRequest = {};
      Socks.interpretUdpRequest(new Uint8Array(recvFromInfo.data), request);
      dbg('received ' + request.data.byteLength + ' bytes datagram for ' +
          request.addressString + ':' + request.port);
      // TODO(yangoon): actually forward the datagram!
    }

    // TODO(yangoon): add destroy() method

    /**
     * Returns the address on which the local socket associated with this
     * relay is listening.
     */
    public getAddress = () => {
      return this.address;
    }

    /**
     * Returns the port on which the local socket associated with this
     * relay is listening.
     */
    public getPort = () => {
      return this.port;
    }
  }

  // Debug helpers.
  var modulePrefix_ = '[UDP-RELAY] ';
  function dbg(msg:string) { console.log(modulePrefix_ + msg); }
  function dbgWarn(msg:string) { console.warn(modulePrefix_ + msg); }
  function dbgErr(msg:string) { console.error(modulePrefix_ + msg); }
}