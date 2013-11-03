"use strict";

var LRU = require("lru-cache");

module.exports = function(options) {
  var locks = LRU(),
      cache = LRU(options);

  return function locked(fn) {
    return function() {
      var args = Array.prototype.slice.call(arguments, 0),
          // extract the eventual callback
          callback = args.pop();

      // replace the callback with a lock function
      args.push(function lock(key, generator) {
        var data;
        if ((data = cache.get(key))) {
          // cache hit!
          return setImmediate(function() {
            return callback.apply(null, [null].concat(data));
          });
        }

        var callbacks;
        if ((callbacks = locks.get(key))) {
          // already cached
          callbacks.push(callback);
          locks.set(key, callbacks);
          return;
        }

        locks.set(key, [callback]);

        return generator(function unlock(err) {
          args = Array.prototype.slice.call(arguments, 0);

          var data = args.slice(1),
              waiting = locks.get(key);

          // clear the lock now that we've got a list of pending callbacks
          locks.del(key);

          if (!err) {
            // store the data as an array
            cache.set(key, data);
          }

          // pass generated data to all waiting callbacks
          waiting.forEach(function(cb) {
            return setImmediate(function() {
              return cb.apply(null, args);
            });
          });
        });
      });

      // call the wrapped function with updated arguments
      return fn.apply(null, args);
    };
  };
};
