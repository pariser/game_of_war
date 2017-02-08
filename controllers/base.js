var _ = require('underscore');

module.exports = (function() {
  "use strict";

  function BaseController() {};

  BaseController.prototype._name = '';

  BaseController.prototype.jsonSuccess = function(res, data) {
    res.send({ success: true, data: data });
  };

  BaseController.prototype.jsonError = function(res, data, message, code) {
    var response = {}

    if (typeof message === 'undefined') {
      message = 'Unexpected Error';
    }

    if (typeof code === 'undefined') {
      code = 500;
    }

    res.status(code).send({ success: false, data: data, message: message });
  };

  BaseController.prototype.jsonResponseHandler = function(res, errorCode) {
    var self = this;

    return function(err, data) {
      if (err) {
        return self.jsonError(res, data, err.toString(), errorCode);
      }

      self.jsonSuccess(res, data);
    };
  };

  BaseController.prototype.checkParams = function(obj, options) {
    var args = {};

    if (options.permitted) {
      options.permitted.forEach(function(permitted) {
        if (_.has(obj, permitted)) {
          args[permitted] = obj[permitted];
        }
      });
    }

    if (options.required) {
      options.required.forEach(function(required) {
        if (!_.has(obj, required)) {
          throw new Error("Expected argument: " + required);
        }
        args[required] = obj[required];
      });
    }

    return args;
  };


  return BaseController;
}());
