var _ = require('underscore');
var express = require('express');

var router = express.Router();
var gamesController = require('../controllers/games');

router.post('/', _.bind(gamesController.startGame, gamesController));
router.post('/:id/shuffle_deck', _.bind(gamesController.shuffleDeck, gamesController));
router.get('/:id/declare_winner/:player', _.bind(gamesController.declareWinner, gamesController));

module.exports = router;
