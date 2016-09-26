// Create our Mixins namespace
Game.Mixins = {};

Game.Mixins.MessageRecipient = {
    name: 'MessageRecipient',
    init: function(template) {
        this._messages = [];
    },
    recieveMessage: function(message) {
        this._messages.push(message);
    },
    getMessages: function() {
        return this._messages;
    },
    clearMessages: function() {
        this._messages = [];
    }
};

Game.Mixins.Sight = {
    name: 'Sight',
    groupName: 'Sight',
    init: function(template) {
        this._sightRadius = template['sightRadius'] || 5;
    },
    getSightRadius: function() {
        return this._sightRadius;
    }
};

// Main player's actor mixin
Game.Mixins.PlayerActor = {
    name: 'PlayerActor',
    groupName: 'Actor',
    act: function() {
        if(this.getHp() < 1){
            Game.Screen.playScreen.setGameEnded(true);
            
            Game.sendMessages(this, 'You have died... Press [Enter] to continue!');
        }
        // Re-render the screen
        Game.refresh();
        // Lock the engine and wait asynchronously
        // for the player to press a key.
        this.getMap().getEngine().lock();

        this.clearMessages();
    }
};

Game.Mixins.FungusActor = {
    name: 'FungusActor',
    groupName: 'Actor',
    init: function() {
        this._growthsRemaining = 5;
    },
    act: function() {
        // Check if we are going to try growing this turn
        if (this._growthsRemaining > 0) {
            if (Math.random() <= 0.02) {
                // Generate the coordinates of a random adjacent square by
                // generating an offset between [-1, 0, 1] for both the x and
                // y directions. To do this, we generate a number from 0-2 and then
                // subtract 1.
                var xOffset = Math.floor(Math.random() * 3) - 1;
                var yOffset = Math.floor(Math.random() * 3) - 1;
                // Make sure we aren't trying to spawn on the same tile as us
                if (xOffset !== 0 || yOffset !== 0) {
                    // Check if we can actually spawn at that location, and if so
                    // then we grow!
                    if (this.getMap().isEmptyFloor(this.getX() + xOffset,
                            this.getY() + yOffset,
                            this.getZ())) {
                        var entity = new Game.Entity(Game.FungusTemplate);
                        entity.setPosition(this.getX() + xOffset,
                            this.getY() + yOffset,
                            this.getZ());

                        this.getMap().addEntity(entity);
                        this._growthsRemaining--;

                        Game.sendMessageNearby(this.getMap(),
                            entity.getX(), entity.getY(), entity.getZ(),
                            'The fungii is spreading!');
                    }
                }
            }
        }
    }
};
Game.Mixins.WanderActor = {
    name : 'WanderActor',
    groupName: 'Actor',
    act : function(){
        var moveOffset = (Math.round(Math.random()) === 1) ? 1 : -1;
        
        if(Math.round(Math.random()) === 1){
            this.tryMove(this.getX() + moveOffset, this.getY(), this.getZ());
        } else {
            this.tryMove(this.getX(), this.getY() + moveOffset, this.getZ());
        }
    }
};

// This signifies our entity can attack basic destructible enities
Game.Mixins.Attacker = {
    name: 'Attacker',
    groupName: 'Attacker',
    init: function(template) {
        this._attackValue = template['attackValue'] || 1;
    },
    getAttackValue: function() {
        return this._attackValue;
    },
    attack: function(target) {
        // Only remove the entity if they were attackable
        if (target.hasMixin('Destructible')) {
            var attack = this.getAttackValue();
            var defense = target.getDefenseValue();
            var max = Math.max(0, attack - defense);
            var damage = 1 + Math.floor(Math.random() * max);

            Game.sendMessage(this, 'You did %d damage to the %s!', [damage, target.getName()]);
            Game.sendMessage(target, 'The %s does %d damage to you!', [this.getName(), damage]);

            target.takeDamage(this, damage);
        }
    }
};

// This mixin signifies an entity can take damage and be destroyed
Game.Mixins.Destructible = {
    name: 'Destructible',
    init: function(template) {
        this._maxHp = template['maxHp'] || 10;

        this._hp = template['hp'] || this._maxHp;

        this._defenseValue = template['defenseValue'] || 0;
    },
    getHp: function() {
        return this._hp;
    },
    getMaxHp: function() {
        return this._maxHp;
    },
    getDefenseValue: function() {
        return this._defenseValue;
    },
    takeDamage: function(attacker, damage) {
        this._hp -= damage;
        // If have 0 or less HP, then remove ourseles from the map
        if (this._hp <= 0) {
            Game.sendMessage(attacker, 'You killed the %s!', [this.getName()]);
            if(this.hasMixin(Game.Mixins.PlayerActor)){
                this.act();
            } else {
                this.getMap().removeEntity(this);
            }
        }
    }
};

Game.sendMessage = function(recipient, message, args) {
    if (recipient.hasMixin(Game.Mixins.MessageRecipient)) {
        if (args) {
            message = vsprintf(message, args);
        }
        recipient.recieveMessage(message);
    }
};

Game.sendMessageNearby = function(map, centerX, centerY, centerZ, message, args) {
    if (args) {
        message = vsprintf(message, args);
    }

    entities = map.getEntitiesWithinRadius(centerX, centerY, centerZ, 5);

    for (var i = 0; i < entities.length; i++) {
        if (entities[i].hasMixin(Game.Mixins.MessageRecipient)) {
            entities[i].recieveMessage(message);
        }
    }
};

// Player template
Game.PlayerTemplate = {
    character: '@',
    foreground: 'white',
    maxHp: 40,
    attackValue: 10,
    sightRadius: 6,
    mixins: [Game.Mixins.PlayerActor,
        Game.Mixins.Attacker, Game.Mixins.Destructible,
        Game.Mixins.MessageRecipient, Game.Mixins.Sight]
};
    // Fungus template
Game.FungusTemplate = {
    character: 'F',
    name: 'fungus',
    foreground: 'green',
    maxHp: 10,
    mixins: [Game.Mixins.FungusActor, Game.Mixins.Destructible]
};
//Bat Template
Game.BatTemplate = {
    name : 'bat',
    character : 'B',
    foreground : 'white',
    maxHP : 6,
    attackValue : 3,
    mixins : [Game.Mixins.WanderActor, Game.Mixins.Attacker, Game.Mixins.Destructible]
};
//Newt Template
Game.NewtTemplate = {
    name : 'newt',
    character : ':',
    foreground : 'yellow',
    maxHp: 3,
    attackValue: 1,
    mixins: [Game.Mixins.WanderActor, Game.Mixins.Attacker, Game.Mixins.Destructible]
};