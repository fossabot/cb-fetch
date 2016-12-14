;(function (root, factory) {
  if (typeof define === 'function' && define.amd)
    define([], factory);
  else if (typeof exports === 'object' && !!exports && !exports.nodeType) {
    if (typeof module === 'object' && !!module && module.exports)
      module.exports = factory();
    else
      exports.default = factory();
  } else if (typeof YUI === 'function' && YUI.add)
    YUI.add('cb-fetch', function (Y) { Y.default = factory(); }, '1.0.0-beta.1');
  else if (root.request)
    self.console &&
    self.console.warn &&
    self.console.warn('Module registration aborted! %O already exists.', root.request);
  else
    root.request = factory();
})((function () {
  try {
    return Function('return this')() || (42, eval)('this');
  } catch (e) {
    return self;
  }
})(), function () {

  function errorHandler(error) {
    self.console &&
    self.console.error &&
    self.console.error(error.message || error.description);
  }

  function raiseException(msg, type) {
    type = type || 'TypeError';

    throw new (self[type] || self.Error)(msg);
  }

  function XHR() {
    var flags = cfg.settings && {
        mozAnon:   !!cfg.settings.mozAnon,
        mozSystem: !!cfg.settings.mozSystem
      };

    if (self.XMLHttpRequest
    /*@cc_on@if(@_jscript_version<9)
      && options.method !== 'PATCH'
    @else
      && options.method !== 'PATCH' && document.documentMode >= 9
    @end@*/)
      return new self.XMLHttpRequest(flags);
    /*@cc_on@if(@_jscript_version>=5)else {
      var progIDs = ['Msxml2.XMLHTTP.6.0', 'Msxml2.XMLHTTP.3.0', 'Microsoft.XMLHTTP'];

      for (var i = 0; i < progIDs.length; ++i) {
        try { return new self.ActiveXObject(progIDs[i]) }
        catch (e) {}
      }
    } @end@*/
  }

  function setQueryString() {
    var prefix = (/^[^#?]+\?/).test(options.url) ? '&' : '?',
        EURIC  = self.encodeURIComponent;

    // https://github.com/w3c/web-platform-tests/commit/d9d33e2
    options.url = options.url.split('#')[0];

    if (self.URLSearchParams && Object.prototype.toString.call(options.parameters) === '[object URLSearchParams]')
      options.parameters = options.parameters.toString();
    if (String.isString(options.parameters)) {
      var pairs  = options.parameters.split('&'),
          len    = pairs.length,
          pair, i;

      for (i = 0; i < len; ++i) {
        pair = pairs[i].split('=');
        options.url += (i ? '&' : prefix) + EURIC(pair[0]) + '=' + EURIC(pair[1]);
      }
    } else if (typeof options.parameters === 'object') {
      for (var key in options.parameters) {
        options.url += prefix + EURIC(key) + '=' + EURIC(options.parameters[key]);
        prefix = '&';
      }
    } else
      raiseException();
  }

  function setRequestMediaType() {
    var headers = options.headers,
        key;

    if (self.Headers && Object.prototype.toString.call(headers) === '[object Headers]')
      headers.get('content-type') || headers.set('Content-Type', 'application/x-www-form-urlencoded');
    else {
      for (key in headers) {
        if (key.toLowerCase() === 'content-type' && headers[key])
          return;
      }
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
    }
  }

  function getGeneralHeaders(instance) {
    return {
      'Cache-Control':     instance.get('Cache-Control'),
      'Connection':        instance.get('Connection'),
      'Date':              instance.get('Date'),
      'Pragma':            instance.get('Pragma'),
      'Trailer':           instance.get('Trailer'),
      'Transfer-Encoding': instance.get('Transfer-Encoding'),
      'Upgrade':           instance.get('Upgrade'),
      'Via':               instance.get('Via'),
      'Warning':           instance.get('Warning')
    };
  }

  function HeadersToObject(instance) {
    var headers = {},
        entries, pair, name, value, separator;

    // https://bugzilla.mozilla.org/show_bug.cgi?id=1108181
    if (instance.entries) {
      entries = instance.entries();
      while (!(pair = entries.next()).done) {
        name      = pair.value[0];
        value     = pair.value[1];
        separator = name.toLowerCase() === 'cookie' ? '; ' : ', ';
        if (value)
          headers[name] = headers[name] ? headers[name] + separator + value : value;
      }
    } else
      return getGeneralHeaders(instance);
    return headers;
  }

  function setRequestHeaders(xhr) {
    var headers, key, separator;

    if (self.Headers && Object.prototype.toString.call(options.headers) === '[object Headers]')
      headers = headersToObject(options.headers);
    else {
      headers = {};
      for (key in options.headers) {
        separator = key.toLowerCase() === 'cookie' ? '; ' : ', ';
        if (options.headers[key])
          headers[key] = (headers[key] ? headers[key] + separator : '') + options.headers[key];
      }
    }
    for (key in headers) xhr.setRequestHeader(key, headers[key]);

    // https://bugs.chromium.org/p/chromium/issues/detail?id=128323#c3
    // https://technet.microsoft.com/library/security/ms04-004
    if (!headers.Authorization && options.username)
      xhr.setRequestHeader('Authorization', 'Basic ' + self.btoa(options.username + ':' + (options.password || '')));
  }

  function getResponse(xhr) {
    if (typeof xhr.responseType === 'string') {
      switch (xhr.responseType) {
        case 'text':
        case 'moz-chunked-text':
        case '':
          return xhr.responseText;
        case 'document':
        case 'msxml-document':
          return xhr.responseXML;
        default:
          return xhr.response;
      }
    }
    if (typeof xhr.responseText === 'string')
      return xhr.responseText;
    if (typeof xhr.responseXML === 'object')
      return xhr.responseXML;
  }

  function xhrPath() {
    var xhr     = XHR(),
        success = cfg.success,
        fail    = cfg.error,
        cleanExit;

    // https://support.microsoft.com/en-us/kb/2856746
    if (self.attachEvent) {
      cleanExit = function () {
        xhr.onreadystatechange = function () {};
        xhr.abort();
      };
      self.attachEvent('onunload', cleanExit);
    }

    // since the XHR instance won't be reused
    // the handler can be placed before open
    xhr.onreadystatechange = function () {
      if (xhr.readyState == 4) {
          self.detachEvent && self.detachEvent('onunload', cleanExit);
          xhr.onreadystatechange = function () {};

        try {
          if ((xhr.status >= 200 && xhr.status < 300) ||
              (xhr.status == 304 || xhr.status == 1223) ||
              // Android status 206
              // applicationCache IDLE
              // Opera status 304
              (xhr.status === 0 && getResponse(xhr)))
            success(processXHR(xhr));
          else if (fail)
            fail(processXHR(xhr));
        // Firefox status 408
        // IE9 error c00c023f
        } catch (e) {
          errorHandler(e);
          fail && fail({instance: xhr});
        }

        xhr = null;
      }
    };

    xhr.open(options.method, options.url, true, options.username, options.password);

    if (options.responseType) {
      try {
        xhr.responseType = options.responseType;
      } catch (e) {
        errorHandler(e);
      }
    }

    if (options.credentials === 'include' && typeof xhr.withCredentials === 'boolean')
      xhr.withCredentials = true;

    if (options.timeout && typeof xhr.timeout === 'number')
      xhr.timeout = options.timeout;

    if (options.responseMediaType && xhr.overrideMimeType)
      xhr.overrideMimeType(options.responseMediaType);

    if (xhr.setRequestHeader)
      setRequestHeaders(xhr);

    xhr.send(/^(POST|PUT|PATCH)$/.test(options.method) ? (options.body || '') : null);
  }

  function processStatus(instance) {
    return self.Promise[instance.ok || instance.status == 304 ? 'resolve' : 'reject'](processedResponse);
  }

  function storeBody(body) {
    if (options.responseType === 'document' || options.responseType === 'msxml-document')
      processedResponse.body = createDocument(body);
    else
      processedResponse.body = body;
    return processedResponse.instance;
  }

  function extractBody(response) {
    switch (options.responseType) {
      case 'text':
      case 'moz-chunked-text':
      case '':
      case 'document':
      case 'msxml-document':
        return response.text();
      case 'json':
        return response.json();
      case 'arraybuffer':
      case 'moz-chunked-arraybuffer':
        return response.arrayBuffer();
      case 'blob':
      case 'moz-blob':
        // PhantomJS didn't support blobs until version 2.0
        if (self.Response.prototype.blob) return response.blob();
        break;
      case 'formdata':
        // https://bugs.chromium.org/p/chromium/issues/detail?id=455103
        if (self.Response.prototype.formData) return response.formData();
    }
    return self.Promise.resolve(response.body || null);
  }

  function convertResponse(response) {
    processedResponse.headers    = HeadersToObject(response.headers);
    processedResponse.instance   = response;
    processedResponse.statusCode = response.status;
    processedResponse.statusText = response.statusText;
    processedResponse.url        = response.url;
    return response;
  }

  function processXHR(xhr) {
    processedResponse.headers    = getResponseHeaders(xhr);
    processedResponse.body       = getBody(xhr);
    processedResponse.instance   = xhr;
    processedResponse.statusCode = xhr.status === 1223 ? 204 : xhr.status;
    processedResponse.url        = xhr.responseURL;

    // https://bugzilla.mozilla.org/show_bug.cgi?id=596634
    try {
      processedResponse.statusText = xhr.status === 1223 ? 'No Content' : xhr.statusText;
    } catch (e) {
      processedResponse.statusText = '';
    }
    return processedResponse;
  }

  function getBody(xhr) {
    var response = getResponse(xhr);

    switch (options.responseType) {
      case 'document':
      case 'msxml-document':
        if (typeof response === 'string')
          return createDocument(response);
        break;
      case 'json':
        // RFC 4627
        if (typeof response !== 'object') {
          try {
            return self.JSON.parse(response + '');
          } catch (e) {}
        }
    }
    return response;
  }

  function createDocument(serializedDocument) {
    var progIDs        = ['MSXML2.DOMDocument.6.0',
                          'MSXML2.DOMDocument.5.0',
                          'MSXML2.DOMDocument.4.0',
                          'MSXML2.DOMDocument.3.0',
                          'MSXML2.DOMDocument',
                          'Microsoft.XMLDOM',
                          'MSXML.DOMDocument'],
        len            = progIDs.length,
        queryLanguage  = cfg.settings && cfg.settings.XSLPattern ? 'XSLPattern' : 'XPath',
        implementation = self.document.implementation,
        MIMEType       = documentMIMEType(),
        doc, parser, input, i;

    if (implementation && implementation.createLSParser) {
      parser = implementation.createLSParser(1, null);
      input = implementation.createLSInput();
      input.stringData = serializedDocument;
      return parser.parse(input);
    } else if (self.DOMParser) {
      // https://bug98304.bugzilla.mozilla.org/show_bug.cgi?id=102699
      try {
        doc = (new self.DOMParser()).parseFromString(serializedDocument, MIMEType);
      } catch (e) {}
      // https://bugs.chromium.org/p/chromium/issues/detail?id=265379
      if (!doc && MIMEType === 'text/html')
        return createHTMLDocument(serializedDocument);
      return doc;
    } else if (self.ActiveXObject) {
      for (i = 0; i < len; ++i) {
        try {
          doc = new self.ActiveXObject(progIDs[i]);
          if (progIDs[i] === 'MSXML2.DOMDocument.3.0')
            doc.setProperty('SelectionLanguage', queryLanguage);
          doc.async = false;
          doc.loadXML(serializedDocument);
          return doc;
        } catch (e) {}
      }
    }
  }

  function createHTMLDocument(str) {
    var implementation = self.document.implementation,
        doc, doctype;

    if (implementation.createHTMLDocument)
      doc = implementation.createHTMLDocument(null, '', null);
    else {
      doctype = implementation.createDocumentType('html', '', '');
      doc = implementation.createDocument('', 'html', doctype);
    }
    doc.documentElement.innerHTML = str;
    return doc;
  }

  function documentMIMEType() {
    var MIMEType = options.responseMediaType ||
                   processedResponse.headers['content-type'];

    // https://w3c.github.io/DOM-Parsing/#idl-def-supportedtype
    switch (MIMEType) {
      case 'text/html':
      case 'text/xml':
      case 'application/xml':
      case 'application/xhtml+xml':
      case 'image/svg+xml':
        break;
      default:
        MIMEType = 'text/xml';
    }
    return MIMEType;
  }

  function getResponseHeaders(xhr) {
    var getResponseHeader = xhr.getResponseHeader,
        exposedHeaders    = cfg.settings && cfg.settings.headers,
        headers           = {},
        list              = xhr.getAllResponseHeaders(),
        fields, field, len, index, name, value, i;

    // https://bugzilla.mozilla.org/show_bug.cgi?id=608735
    if (options.mode === 'cors' && !list) {
      // https://www.w3.org/TR/cors/#simple-response-header
      headers['Cache-Control']    = getResponseHeader('Cache-Control');
      headers['Content-Language'] = getResponseHeader('Content-Language');
      headers['Content-Type']     = getResponseHeader('Content-Type');
      headers.Expires             = getResponseHeader('Expires');
      headers['Last-Modified']    = getResponseHeader('Last-Modified');
      headers.Pragma              = getResponseHeader('Pragma');

      if (exposedHeaders) {
        for (name in exposedHeaders) {
          if (exposedHeaders[name] &&
              name.toLowerCase() !== 'set-cookie' &&
              name.toLowerCase() !== 'set-cookie2')
            headers[name] = getResponseHeader(name);
        }
      }
    } else if (list) {
      fields = list.split('\r\n');
      len    = fields.length;
      for (i = 0; i < len; ++i) {
        field = fields[i];
        index = field.indexOf(': ');
        if (index > 0) {
          name  = field.substring(0, index).toLowerCase();
          value = field.substring(index + 2);
          headers[name] = value;
        }
      }
    }
    return headers;
  }

  // https://support.microsoft.com/en-us/kb/834489
  // https://bugzilla.mozilla.org/show_bug.cgi?id=709991
  function stripAuth(url) {
    if ((/^([^#?]+:)?\/\/[^\/]+@/).test(url)) {
      var credentials = url.split('//')[1].split('@')[0].split(':');

      if (!options.username) {
        options.username = credentials[0];
        options.password = credentials[1];
      }
      return url.replace(/\/\/[^\/]+@/, '//');
    }
    return url;
  }

  function processURL(url) {
    if (String.isString(url.href)) {
      if (!options.username) {
        options.username = url.username;
        options.password = url.password;
      }
      // https://bugzilla.mozilla.org/show_bug.cgi?id=1195820
      url.username = url.password = '';
      options.url = url.href;
    } else
      raiseException();
  }

  function processInput(input) {
    if (String.isString(input))
      options.url = stripAuth(input);
    else if (self.URL && Object.prototype.toString.call(input) === '[object URL]')
      processURL(input);
    else if (typeof input === 'object' && !!input) {
      options = input;
      if (self.URL && Object.prototype.toString.call(options.url) === '[object URL]')
        processURL(options.url);
      else if (String.isString(options.url))
        options.url = stripAuth(options.url);
    } else
      raiseException();
  }

  var request           = {},
      options           = {},
      processedResponse = {},
      cfg,
      init = function (input) {
    processInput(input);

    // https://bugzilla.mozilla.org/show_bug.cgi?id=484396
    options.url         = options.url || self.location.href;
    options.method      = (options.method && options.method.toUpperCase()) || 'GET';
    options.mode        = options.mode || 'cors';
    options.credentials = options.credentials || 'same-origin';
    options.headers     = options.headers || {};
    options.username    = options.username || null;
    options.password    = options.password || null;

    return request;
  };

  request.done = function (onSuccess, onFail) {
    cfg = typeof onSuccess === 'object' && onSuccess || {
      success: onSuccess,
      error:   onFail
    };

    if (typeof cfg.success !== 'function')
      raiseException('A success callback must be provided.');
    if (typeof cfg.error !== 'undefined' && typeof cfg.error !== 'function')
      raiseException('The failure callback must be a function.');

    if (/^(POST|PUT|PATCH)$/.test(options.method))
      setRequestMediaType();
    else if (options.parameters)
      setQueryString();

    if (self.fetch && !self.fetch.nodeType)
      self.fetch(options.url, options)
        .then(convertResponse)
        .then(extractBody)
        .then(storeBody)
        .then(processStatus)
        .then(cfg.success, cfg.error);
    else
      xhrPath();
  };

  function addVerb(verb) {
    request[verb] = function (url) {
      var supportBody = /^(patch|post|put)$/.test(verb),
          action  = supportBody ? 'send' : 'query',
          payload = supportBody ? 'body' : 'parameters',
          context = {};

      if (self.URL && Object.prototype.toString.call(url) === '[object URL]')
        processURL(url);
      else if (String.isString(url))
        options.url = stripAuth(url);
      options.method = verb.toUpperCase();

      context[action] = function (data) {
        options[payload] = data || options[payload];
        return { done: request.done };
      };
      context.done = request.done;

      return context;
    };
  }

  addVerb('post');
  addVerb('put');
  addVerb('patch');
  addVerb('get');
  addVerb('head');
  addVerb('delete');

  return init;
});