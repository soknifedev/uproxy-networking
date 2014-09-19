var script = document.createElement('script');
script.setAttribute('data-manifest', 'freedom-module.json');
script.textContent = '{ "debug": "log" }';
script.src = 'lib/freedom/freedom-for-chrome-for-uproxy.js';
document.head.appendChild(script);

// Note that the proxy runs very slowly at debug level ('*:D').
Logging.setConsoleFilter(['*:I']);