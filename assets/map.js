Game.Map = function(tiles, player) {
    this._tiles = tiles;
    // cache the width and height based
    // on the length of the dimensions of
    // the tiles array
    this._depth = tiles.length;
    this._width = tiles[0].length;
    this._height = tiles[0][0].length;
    
    this._fov = [];
    this.setupFov();

    // create a list which will hold the entities
    this._entities = {};
    // create the engine and scheduler
    this._scheduler = new ROT.Scheduler.Simple();
    this._engine = new ROT.Engine(this._scheduler);
    // add the player
    this.addEntityAtRandomPosition(player, 0);
    // add random enemies
    var templates = [Game.FungusTemplate, Game.BatTemplate, Game.NewtTemplate];
    
    for (var z = 0; z < this._depth; z++) {
        for (var i = 0; i < 15; i++) {
            var template = templates[Math.floor(Math.random() * templates.length)];
            
            this.addEntityAtRandomPosition(new Game.Entity(template), z);
        }
    }
    
    //Setup the explored array
    this._explored = new Array(this._depth);
    this._setupExploredArray();
};

// Standard getters
Game.Map.prototype.getWidth = function() {
    return this._width;
};
Game.Map.prototype.getHeight = function() {
    return this._height;
};
Game.Map.prototype.getDepth = function() {
    return this._depth;
};

Game.Map.prototype._setupExploredArray = function(){
    for(var z = 0; z < this._depth; z++){
        this._explored[z] = new Array(this._width);
        
        for(var x = 0; x < this._width; x++){
            this._explored[z][x] = new Array(this._height);
            for(var y = 0; y < this._height; y++){
                this._explored[z][x][y] = false;
            }
        }
    }
};

Game.Map.prototype.setupFov = function() {
    var map = this;
    
    for (var z = 0; z < this._depth; z++){
        (function(){
            var depth = z;
            map._fov.push(
                new ROT.FOV.DiscreteShadowcasting(function(x,y){
                    return !map.getTile(x, y, depth).isBlockingLight();
                }, {topology:4}));
        })();
    }
};

Game.Map.prototype.getFov = function(depth){
    return this._fov[depth];
};

// Gets the tile for a given coordinate set
Game.Map.prototype.getTile = function(x, y, z) {
    // Make sure we are inside the bounds. If we aren't, return
    // null tile.
    if (x < 0 || x >= this._width || y < 0 || y >= this._height || z < 0 || z >= this._depth) {
        return Game.Tile.nullTile;
    } else {
        return this._tiles[z][x][y] || Game.Tile.nullTile;
    }
};

Game.Map.prototype.setExplored = function(x, y, z, state){
    if(this.getTile(x, y, z) !== Game.Tile.nullTile){
        this._explored[z][x][y] = state;
    }
};

Game.Map.prototype.isExplored = function(x, y, z){
    if(this.getTile(x, y, z) !== Game.Tile.nullTile){
        return this._explored[z][x][y];
        
    } else {
        return false;
    }
};

Game.Map.prototype.dig = function(x, y, z) {
    // If the tile is diggable, update it to a floor
    if (this.getTile(x, y, z).isDiggable()) {
        this._tiles[z][x][y] = Game.Tile.floorTile;
    }
};

Game.Map.prototype.isEmptyFloor = function(x, y, z) {
    // Check if the tile is floor and also has no entity
    return this.getTile(x, y, z) == Game.Tile.floorTile &&
        !this.getEntityAt(x, y, z);
};

Game.Map.prototype.getRandomFloorPosition = function(z) {
    // Randomly generate a tile which is a floor
    var x, y;
    do {
        x = Math.floor(Math.random() * this._width);
        y = Math.floor(Math.random() * this._height);
    } while (!this.isEmptyFloor(x, y, z));
    return {
        x: x,
        y: y,
        z: z
    };
};

Game.Map.prototype.getEngine = function() {
    return this._engine;
};
Game.Map.prototype.getEntities = function() {
    return this._entities;
};
Game.Map.prototype.getEntityAt = function(x, y, z) {
    // Get entity based on position key
    return this._entities[x + ',' + y + ',' + z];
};

Game.Map.prototype.addEntity = function(entity) {
    // Update the entity's map
    entity.setMap(this);
    // Add the entity to the list of entities
    this.updateEntityPosition(entity);
    // Check if this entity is an actor, and if so add
    // them to the scheduler
    if (entity.hasMixin('Actor')) {
        this._scheduler.add(entity, true);
    }
};

Game.Map.prototype.addEntityAtRandomPosition = function(entity, z) {
    var position = this.getRandomFloorPosition(z);
    entity.setX(position.x);
    entity.setY(position.y);
    entity.setZ(position.z);
    this.addEntity(entity);
};

Game.Map.prototype.removeEntity = function(entity) {
    // Remove the entity from the map
    var key = entity.getX() + ',' + entity.getY() + ',' + entity.getZ();
    
    if(this._entities[key] == entity){
        delete this._entities[key];
    }
    // If the entity is an actor, remove them from the scheduler
    if (entity.hasMixin('Actor')) {
        this._scheduler.remove(entity);
    }
};

Game.Map.prototype.getEntitiesWithinRadius = function(centerX, centerY, centerZ, radius) {
    results = [];

    var leftX = centerX - radius;
    var rightX = centerX + radius;
    var topY = centerY - radius;
    var bottomY = centerY + radius;

    for (var key in this._entities) {
        var entity = this._entities[key];
        
        if (entity.getX() >= leftX &&
            entity.getX() <= rightX &&
            entity.getY() >= topY &&
            entity.getY() <= bottomY &&
            entity.getZ() == centerZ) {
            results.push(entity);
        }
    }
    return results;
};

Game.Map.prototype.updateEntityPosition = function(entity, oldX, oldY, oldZ){
    if(oldX){
        var oldKey = oldX + ',' + oldY + ',' + oldZ;
        if(this._entities[oldKey] == entity){
            delete this._entities[oldKey];
        }
    }
    
    //Make sure it is within bounds
    if(entity.getX() < 0 || entity.getX() >= this._width ||
    entity.getY() < 0 || entity.getY() >= this._height ||
    entity.getZ() < 0 || entity.getZ() >= this._depth){
        throw new Error("Entity's position is out of bounds. UEP in MAP");
    }
    
    var key = entity.getX() + ',' + entity.getY() + ',' + entity.getZ();
    if(this._entities[key]){
        throw new Error("Tried to add entity to occupied position. UEP in MAP.");
    }
    
    this._entities[key] = entity;
};