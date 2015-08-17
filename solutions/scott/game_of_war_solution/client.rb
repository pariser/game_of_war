#!/usr/bin/env ruby

require 'pp'
require 'rest-client'
require 'json'
require 'colored'
require 'byebug'
require 'curses'
require 'asciiart'

SERVER_URL = 'http://war.learnup.com'
NAME = ARGV[0] || 'smtlaissezfaire'
EMAIL = ARGV[1] || 'scott@railsnewbie.com'

class AsciiArtImage
  IMAGES = {
    "Alexis" => "http://d3h58ti7lx89tg.cloudfront.net/assets/team/alexis-ringwald-320cd4f7a5eb40b228c92a67bf9be23b.jpg",
    "Kenny" => "http://d3h58ti7lx89tg.cloudfront.net/assets/team/kenny-ma-e6ee84e67f5ce01e7eb07137264d9321.jpg",
    "Dave" => "http://d3h58ti7lx89tg.cloudfront.net/assets/team/dave-haskell-36e61f788a0c05822623f8f73aa57f39.jpg",
    "Scott" => "http://d3h58ti7lx89tg.cloudfront.net/assets/team/scott-taylor-f00a383f33e57150537cbdfb701d273e.jpg",
    "Andrew" => "http://d3h58ti7lx89tg.cloudfront.net/assets/team/andrew-pariser-fa89c3fbbcd586f3c1a686286aef8ff3.jpg",
    "Dan" => "http://d3h58ti7lx89tg.cloudfront.net/assets/team/dan-guilak-e0031addbb539be6d6b60b277eaf8785.jpg",
    "Carey" => "http://d3h58ti7lx89tg.cloudfront.net/assets/team/carey-wong-ccab3266df5407539a3f4d542b0eab57.jpg",
    "Becky" => "http://d3h58ti7lx89tg.cloudfront.net/assets/team/becky-chapman-7ea1d96d1bf5124c9519ca3e7e9541ea.jpg",
    "Breea" => "http://d3h58ti7lx89tg.cloudfront.net/assets/team/breea-1c33ff24d1a20767100b74a01f1c5b2d.jpg",
    "Anna" => "http://d3h58ti7lx89tg.cloudfront.net/assets/team/anna-killgore-13edeeba1b6fe03ed75ecbd396246a41.jpg",
    "JT" => "http://d3h58ti7lx89tg.cloudfront.net/assets/team/jt-katavich-a720cd79ca620acf3c54972369efe550.jpg"
  }

  def self.random_names
    @pair ||= IMAGES.keys.sample(2)
  end

  def self.random_ascii_art_pair
    @random_ascii_art_pair ||= random_names.map do |name|
      image_url = IMAGES[name]
      AsciiArt.new(image_url).to_ascii_art(:width => 40)
    end
  end
end

class OutputFormatter
  include Curses

  def initialize(game)
    @game = game
    @window = Window.new(0, 0, 0, 0)
    init_screen
    crmode

    @column_width = cols / 3
  end

  def output
    @window.clear

    if @game.over?
      @window.refresh
      show_game_over
    else
      show_player(@game.players[0], @column_width * 0)
      show_game_pile_cards(@column_width * 1)
      show_player(@game.players[1], @column_width * 2)
      @window.refresh
      sleep 0
    end
  end

private

  def show_game_over
    width = 40
    height = 7
    x_pos = 3
    y_pos = 2

    @window = Window.new(height, width, (lines - 5) / 2, (cols - width) / 2)
    @window.setpos(y_pos, x_pos - 2)
    @window.box('|', '-')
    @window.addstr("Game Over!".center(width - 2))
    y_pos += 2
    @window.setpos(y_pos, x_pos - 2)

    if @game.tie?
      @window.addstr("THE GAME IS A TIE!".center(width - 2))
    else
      @window.addstr("#{@game.winner.name} IS THE WINNNER!".center(width - 2))
    end

    @window.refresh

    sleep 1000
  end

  def show_game_pile_cards(x_index)
    y_index = 10
    @window.setpos(y_index, x_index)
    @window.addstr("Game Pile".center(@column_width))
    y_index += 1

    str = ''

    @game.game_pile_cards.each_with_index do |card, index|
      str += card.to_s

      if index % 2 == 0
        str += ' '
        y_index += 1
      else
        @window.setpos(y_index, x_index)
        @window.addstr(str.center(@column_width))
        str = ''
      end
    end
  end

  def show_player(player, x_index)
    y_index = 2

    @window.setpos(y_index, x_index)
    @window.addstr("#{player.name}".center(@column_width))

    y_index += 1
    graphic = player.ascii_art
    graphic.split("\n").each do |line|
      @window.setpos(y_index, x_index)
      @window.addstr(line.center(@column_width))
      y_index += 1
    end
    y_index += 1

    start_card_y_index = y_index

    @window.setpos(y_index, x_index)
    @window.addstr("Deck:".center(@column_width / 2))
    y_index += 1

    player.deck.each_with_index do |card, index|
      @window.setpos(y_index, x_index)
      @window.addstr(card.to_s.center(@column_width / 2))
      y_index += 1
    end

    y_index = start_card_y_index
    @window.setpos(y_index, x_index + (@column_width / 2))
    @window.addstr("Collection Pile:".center(@column_width / 2))
    y_index += 1

    player.collection_pile.each_with_index do |card, index|
      @window.setpos(y_index, x_index + @column_width / 2)
      @window.addstr(card.to_s.center(@column_width / 2))
      y_index += 1
    end
  end
end

module GameOfWarAPI
  extend self

  class APIError < StandardError; end

  def start(name, email)
    data = request(:post, "/games", {
      :name => name,
      :email => email,
    })

    {
      :id => data["id"],
      :player_cards => [
        data['one'],
        data['two']
      ]
    }
  end

  def shuffle(game_id, user_one_cards, user_two_cards)
    args = {}

    if user_one_cards
      args[:one] = user_one_cards
    end
    if user_two_cards
      args[:two] = user_two_cards
    end

    data = request(:post, "/games/#{game_id}/shuffle_deck", args)

    {
      :player_cards => [
        data['one'],
        data['two']
      ]
    }
  end

  def declare_winner(game_id, winner)
    data = request(:get, "/games/#{game_id}/declare_winner/#{winner}")

    if data['finished'] != true
      raise APIError, "API Declared not finished!"
    end

    if data['success'] != true
      raise APIError, "API Declared incorrect result"
    end

    true
  end

private

  def request(type, url, data={})
    # puts "* Making API Request: #{type.to_s.upcase}, url: #{url}, data: #{data}".red

    request_options = {
      :method => type,
      :url => "#{SERVER_URL}#{url}",
    }

    headers = {
      :content_type => :json,
      # :accept => :json
    }

    request_options[:headers] = headers

    if !data.empty?
      request_options[:payload] = data.to_json
    end

    res = RestClient::Request.execute(request_options)
    # puts "res: #{res}".red
    res = JSON.parse(res)

    if res['success'] != true
      raise APIError, "error: #{res}"
    end

    res["data"]
  end
end

class GameOfWar
  def initialize(name, email)
    data = GameOfWarAPI.start(name, email)
    @game_id = data[:id]
    # puts "@game_id: #{@game_id}, data: #{data}"
    @players = create_players_with_decks(data[:player_cards])
    @output_formatter = OutputFormatter.new(self)
  end

  attr_reader :players

  def shuffle(shuffle_user_1 = true, shuffle_user_2 = true)
    args = [@game_id]

    args << if shuffle_user_1
      @players[0].collection_pile.map { |card| card.to_s }
    else
      nil
    end

    args << if shuffle_user_2
      @players[1].collection_pile.map { |card| card.to_s }
    else
      nil
    end

    # puts "calling shuffle with args: #{args}"
    res = GameOfWarAPI.shuffle(*args)
    # puts "res: #{res}"
    res[:player_cards].each_with_index do |cards, index|
      if cards
        player = @players[index]
        player.deck = cards
        player.collection_pile = []
      end
    end
  end

  def over?
    @players.any? { |p| p.unable_to_play? }
  end

  def winner
    over? && @players.detect { |player| !player.unable_to_play? }
  end

  def tie?
    over? && !winner
  end

  def game_over!
    # puts ""
    # puts "Game is over!".red

    if tie?
      # puts "THE GAME IS A TIE!".red
      GameOfWarAPI.declare_winner('tie')
    else
      GameOfWarAPI.declare_winner(@game_id, winner.player_1? ? 'one' : 'two')
      # puts "#{winner.name} IS THE WINNNER!".red
    end

    return winner
  end

  def play
    player_1, player_2 = players

    while true do
      @output_formatter.output

      if over?
        game_over!
        break
      end

      if player_1.deck.any? && player_2.deck.any?
        battle
      elsif player_1.deck.empty? && player_2.deck.empty?
        shuffle
      elsif player_1.deck.empty?
        player_1.shuffle
      elsif player_2.deck.empty?
        player_2.shuffle
      end
    end
  end

  def add_card_to_game_pile(player)
    card = player.deck.shift
    self.game_pile_cards << card
    self.game_pile_cards.compact!
    @output_formatter.output
    card
  end

  def game_pile_cards
    @game_pile_cards ||= []
  end

  def reset_game_pile!
    @game_pile_cards = []
  end

private

  def battle
    player_1, player_2 = @players

    player_1_next_card = add_card_to_game_pile(player_1)
    player_2_next_card = add_card_to_game_pile(player_2)

    winner = nil

    if player_1_next_card > player_2_next_card
      winner = player_1
    elsif player_2_next_card > player_1_next_card
      winner = player_2
    else # war!
      winner = play_war
    end

    if winner
      game_pile_cards.each do |card|
        winner.collection_pile << card
      end
      reset_game_pile!

      # puts "* Winner: #{winner.inspect}"
      # puts "* Loser: #{players.reject { |p| p == winner }.inspect}"
      # puts ""
    else
      # puts "No Winner"
    end
  end

  def declare_winner_or_shuffle_if_missing_cards
    player_1, player_2 = @players

    if player_1.unable_to_play? && player_2.unable_to_play?
      return nil
    end

    if player_1.unable_to_play?
      return player_2
    end

    if player_2.unable_to_play?
      return player_1
    end

    if player_1.deck.empty? && player_2.deck.empty?
      shuffle
    end

    player_1.shuffle if player_1.deck.empty?
    player_2.shuffle if player_2.deck.empty?

    winner
  end

  def play_war
    player_1, player_2 = @players
    winner = nil

    # puts "* Entering into war!"

    3.times do
      if winner = declare_winner_or_shuffle_if_missing_cards
        return winner
      end

      card = add_card_to_game_pile(player_1)
      # puts "* Adding to winning cards: #{card} from player 1"

      card = add_card_to_game_pile(player_2)
      # puts "* Adding to winning cards: #{card} from player 2"
    end

    if winner = declare_winner_or_shuffle_if_missing_cards
      return winner
    end

    player_1_card = add_card_to_game_pile(player_1)
    player_2_card = add_card_to_game_pile(player_2)

    if !player_1_card && !player_2_card
      # puts "Neither player has a card. left. No winner"
      winner = nil
    elsif !player_2_card
      winner = player_1
    elsif !player_1_card
      winner = player_2
    elsif player_1_card > player_2_card
      winner = player_1
    elsif player_1_card < player_2_card
      winner = player_2
    else
      return play_war
    end

    # puts "war, winner: #{winner.inspect}, winning_cards: #{winning_cards}"

    winner
  end

  def create_players_with_decks(player_card_names)
    player_number = 1
    player_card_names.map do |cards|
      player = Player.new(self, cards, AsciiArtImage.random_names[player_number - 1], player_number)
      player_number += 1
      player
    end
  end
end

class Card
  include Comparable

  def initialize(string)
    @string = string
    @face_value = calculate_face_value
  end

  attr_accessor :face_value

  def to_s
    @string
  end

  def inspect
    "<Card #{@string}>"
  end

  def <=>(other_card)
    if other_card.respond_to?(:face_value)
      face_value <=> other_card.face_value
    else
      raise "Not Comparable!"
    end
  end

private

  def calculate_face_value
    val = @string[0..-2]

    case val
    when "A"
      14
    when "K"
      13
    when "Q"
      12
    when "J"
      11
    else
      val.to_i
    end
  end
end

class Player
  def initialize(game, cards, name, player_index)
    @game = game
    @deck = cards.map { |card| Card.new(card) }
    @name = name
    @player_index = player_index

    @ascii_art = AsciiArtImage.random_ascii_art_pair[player_1? ? 0 : 1]
  end

  attr_accessor :name
  attr_reader :deck
  attr_reader :ascii_art

  def deck=(card_names)
    @deck = map_card_names(card_names)
  end

  def collection_pile=(card_names)
    @collection_pile = map_card_names(card_names)
  end

  def collection_pile
    @collection_pile ||= []
  end

  def unable_to_play?
    deck.empty? && collection_pile.empty?
  end

  def inspect
    "#<Player name: #{name}, deck: #{deck.inspect}, collection_pile: #{collection_pile.inspect}>"
  end

  def player_1?
    @player_index == 1
  end

  def player_2?
    !player_1
  end

  def shuffle
    if player_1?
      @game.shuffle(true, false)
    else
      @game.shuffle(false, true)
    end
  end

private

  def map_card_names(card_names)
    card_names.map { |card| Card.new(card) }
  end
end

game = GameOfWar.new(NAME, EMAIL)
game.play
