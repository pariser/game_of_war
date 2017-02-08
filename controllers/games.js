var _ = require('underscore');
var async = require('async');
var mongoose = require('mongoose');

var BaseController = require('./base');

var Game = mongoose.model('Game');

module.exports = (function() {
  "use strict";

  var gamesController = new BaseController();

  gamesController.startGame = function(req, res) {
    var params = this.checkParams(req.body, {
      required: [ 'email', 'name' ],
      permitted: [ 'randomSeed', 'randomIndex' ]
    });

    var game = new Game(params);
    game.startGame(this.jsonResponseHandler(res));
  };

  gamesController.shuffleDeck = function(req, res) {
    var params = this.checkParams(req.body, {
      permitted: [ 'one', 'two' ]
    });

    this.findGameAndExecute(res, req.params.id, 'shuffleDeck', params);
  };

  gamesController.declareWinner = function(req, res) {
    this.checkParams(_.omit(req.params, 'id'), {
      required: [ 'player' ],
    });

    this.findGameAndExecute(res, req.params.id, 'declareWinner', req.params.player);
  };

  gamesController.findGameAndExecute = function(res, id, method) {
    var self = this;
    var args = _.toArray(arguments).slice(3);

    async.waterfall([
      function(cb) {
        Game.findOne({ _id: id }, cb)
      },
      function(game, cb) {
        args.push(cb)
        game[method].apply(game, args);
      }
    ], self.jsonResponseHandler(res));
  };

  return gamesController;
}());
