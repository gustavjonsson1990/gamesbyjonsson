Game.Screen = {};

// Define our initial start screen
Game.Screen.startScreen = {
    enter: function() {
        console.log("Entered start screen.");
    },
    exit: function() {
        console.log("Exited start screen.");
    },
    render: function(display) {
        // Render our prompt to the screen
        display.drawText(1, 1, "%c{yellow}Javascript Roguelike");
        display.drawText(1, 2, "Press [Enter] to start!");
    },
    handleInput: function(inputType, inputData) {
        // When [Enter] is pressed, go to the play screen
        if (inputType === 'keydown') {
            if (inputData.keyCode === ROT.VK_RETURN) {
                Game.switchScreen(Game.Screen.playScreen);
            }
        }
    }
};

// Define our playing screen
Game.Screen.playScreen = {
    _map: null,
    _player: null,
    _gameEnded : false,
    enter: function() {
        var map = [];
        // Create a map based on our size parameters
        var width = 100;
        var height = 48;
        var depth = 6;

        var tiles = new Game.Builder(width, height, depth).getTiles();
        this._player = new Game.Entity(Game.PlayerTemplate);
        this._map = new Game.Map(tiles, this._player);

        this._map.getEngine().start();
    },
    exit: function() {
        console.log("Exited play screen.");
    },
    render: function(display) {
        var screenWidth = Game.getScreenWidth();
        var screenHeight = Game.getScreenHeight();
        // Make sure the x-axis doesn't go to the left of the left bound
        var topLeftX = Math.max(0, this._player.getX() - (screenWidth / 2));
        // Make sure we still have enough space to fit an entire game screen
        topLeftX = Math.min(topLeftX, this._map.getWidth() - screenWidth);
        // Make sure the y-axis doesn't above the top bound
        var topLeftY = Math.max(0, this._player.getY() - (screenHeight / 2));
        // Make sure we still have enough space to fit an entire game screen
        topLeftY = Math.min(topLeftY, this._map.getHeight() - screenHeight);
        //Find all visible cells and update the object
        var visibleCells = {};
        
        var map = this._map;
        var currentDepth = this._player.getZ();

        this._map.getFov(currentDepth).compute(
            this._player.getX(), this._player.getY(),
            this._player.getSightRadius(),
            function(x, y, radius, visibility) {
                visibleCells[x + "," + y] = true;
                
                map.setExplored(x, y, currentDepth, true);
            });
        // Iterate through all visible map cells
        for (var x = topLeftX; x < topLeftX + screenWidth; x++) {
            for (var y = topLeftY; y < topLeftY + screenHeight; y++) {
                if(visibleCells[x+','+y]){
                    // Fetch the glyph for the tile and render it to the screen
                    // at the offset position.
                    var tile = this._map.getTile(x, y, this._player.getZ());
                    display.draw(
                        x - topLeftX,
                        y - topLeftY,
                        tile.getChar(),
                        tile.getForeground(),
                        tile.getBackground());
                }
            }
        }
        //Render the explored map cells
        for(var x = topLeftX; x < topLeftX + screenWidth; x++){
            for(var y = topLeftY; y < topLeftY + screenHeight; y++){
                if(map.isExplored(x, y, currentDepth)){
                    var tile = this._map.getTile(x, y, currentDepth);
                    var foreground = visibleCells[x + ',' + y] ? tile.getForeground() : 'darkGray';
                    
                    display.draw(
                        x - topLeftX,
                        y - topLeftY,
                        tile.getChar(),
                        foreground,
                        tile.getBackground());
                }
            }
        }
        // Render the entities
        var entities = this._map.getEntities();
        for (var key in entities) {
            var entity = entities[key];
            // Only render the entitiy if they would show up on the screen
            if (entity.getX() >= topLeftX && entity.getY() >= topLeftY &&
                entity.getX() < topLeftX + screenWidth &&
                entity.getY() < topLeftY + screenHeight &&
                entity.getZ() == this._player.getZ()) {
                if(visibleCells[entity.getX() + ',' + entity.getY()]){
                    display.draw(
                        entity.getX() - topLeftX,
                        entity.getY() - topLeftY,
                        entity.getChar(),
                        entity.getForeground(),
                        entity.getBackground()
                    );
                }
            }
        }

        var messages = this._player.getMessages();
        var messageY = 0;
        for (var i = 0; i < messages.length; i++) {
            messageY += display.drawText(0,
                messageY,
                '%c{white}%b{black}' + messages[i]);
        }

        var stats = '%c{white}%b{black}';
        stats += vsprintf('HP: %d/%d ', [this._player.getHp(), this._player.getMaxHp()]);
        stats += vsprintf('You are on level: %d', [this._player.getZ() + 1]);
        display.drawText(0, screenHeight, stats);
    },
    handleInput: function(inputType, inputData) {
        if(this._gameEnded){
            if(inputType === 'keydown' &&  inputData.keyCode === ROT.VK_RETURN){
                Game.switchScreen(Game.Screen.loseScreen);
            }
            return;
        }
        if (inputType === 'keydown') {
            // If enter is pressed, go to the win screen
            // If escape is pressed, go to lose screen
            if (inputData.keyCode === ROT.VK_RETURN) {
                Game.switchScreen(Game.Screen.winScreen);
            } else if (inputData.keyCode === ROT.VK_ESCAPE) {
                Game.switchScreen(Game.Screen.loseScreen);
            } else {
                // Movement
                if (inputData.keyCode === ROT.VK_LEFT) {
                    this.move(-1, 0, 0);
                } else if (inputData.keyCode === ROT.VK_RIGHT) {
                    this.move(1, 0, 0);
                } else if (inputData.keyCode === ROT.VK_UP) {
                    this.move(0, -1, 0);
                } else if (inputData.keyCode === ROT.VK_DOWN) {
                    this.move(0, 1, 0);
                }
                // Unlock the engine
                this._map.getEngine().unlock();
            }
        } else if (inputType === 'keypress') {
            var keyChar = String.fromCharCode(inputData.charCode);
            if (keyChar === '>') {
                this.move(0, 0, 1);
            } else if (keyChar === '<') {
                this.move(0, 0, -1);
            } else {
                return;
            }

            this._map.getEngine().unlock();
        }
    },
    setGameEnded: function(gameEnded){
        this._gameEnded = gameEnded;
    },
    move: function(dX, dY, dZ) {
        var newX = this._player.getX() + dX;
        var newY = this._player.getY() + dY;
        var newZ = this._player.getZ() + dZ;
        // Try to move to the new cell
        this._player.tryMove(newX, newY, newZ, this._map);
    }
};

// Define our winning screen
Game.Screen.winScreen = {
    enter: function() {
        console.log("Entered win screen.");
    },
    exit: function() {
        console.log("Exited win screen.");
    },
    render: function(display) {
        // Render our prompt to the screen
        for (var i = 0; i < 22; i++) {
            // Generate random background colors
            var r = Math.round(Math.random() * 255);
            var g = Math.round(Math.random() * 255);
            var b = Math.round(Math.random() * 255);
            var background = ROT.Color.toRGB([r, g, b]);
            display.drawText(2, i + 1, "%b{" + background + "}You win!");
        }
    },
    handleInput: function(inputType, inputData) {
        // Nothing to do here      
    }
};

// Define our winning screen
Game.Screen.loseScreen = {
    enter: function() {
        console.log("Entered lose screen.");
    },
    exit: function() {
        console.log("Exited lose screen.");
    },
    render: function(display) {
        // Render our prompt to the screen
        for (var i = 0; i < 22; i++) {
            display.drawText(2, i + 1, "%b{red}You lose! :(");
        }
    },
    handleInput: function(inputType, inputData) {
        // Nothing to do here      
    }
};