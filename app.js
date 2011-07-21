require.paths.unshift('./node_modules')
var models = require("./models"), _ = require("./underscore-min"), password = require("./password");
var restify = require("restify"), utils = require("./utils"), io = require("socket.io");
var mongoose = require("mongoose"), Cookies = require("cookies")

var server = restify.createServer({
    maxRequestSize: 1048576,
    accept: ["text/xml", "text/html", "application/xhtml+xml", "text/plain", "*/*;q=0.8", "image/png", "image/*;q=0.8", "*/*;q=0.5"]
});


function authenticate(req, res, next){
    var authCookie = utils.getAuthCookie(req, res);	
    if (authCookie) {
        var userAuth = JSON.parse(utils.decrypt(authCookie));
        req.user_id = userAuth.uid;        
    }
    else {
        res.send(403);
    }
    return next();
}


var pre = [authenticate];

//restify.log.level(restify.LogLevel.Trace);

server.get('/users', pre, function(req, res){
    mongoose.connect(utils.getConnection());
    console.log(req.User);
    models.User.find({}, function(err, docs){
        res.send(200, docs);
    })
    
});

server.get('/children', pre, function(req, res){
    try {
        mongoose.connect(utils.getConnection());
        
        models.Child.find({
            useraccess: req.user_id
        }, ['firstName', 'middleName', 'lastName', 'dob', 'pictureID'], {
            sort: {
                lastName: 1
            }
        }, function(err, docs){            
            res.send(200, docs);
        });
    } 
    catch (err) {
        utils.logError(err,req);
        res.send(500);
    }
    
});

server.post('/children/add-access', pre, function(req, res){
    try {
        mongoose.connect(utils.getConnection());
        models.User.findOne({
            email: req.params.email.toLowerCase()
        }, {
            firstName: 1,
            lastName: 1
        }, function(err, user){
            if (err) {
                utils.logError(err,req);
                res.send(500);
            }
            else {
                if (user) {
                    models.Child.findById(req.params.childID, function(err, child){
                        if (err) {
                            utils.logError(err,req);
                            es.send(500);
                        }
                        else {
                            try {
                                child.execIfUserHasAuth(req.user_id, function(){
                                    if (child.useraccess.indexOf(user._id) >= 0) {
                                        console.log("user already shared");
                                        res.send(200, user);
                                    }
                                    else {
                                        console.log("user shared");
                                        child.useraccess.push(user._id);
                                        child.save(function(err){
                                            if (err) {
                                                utils.logError(err,req);
                                                res.send(500);
                                            }
                                            else {
                                                res.send(200, user);
                                            }
                                        });
                                    }
                                });
                            } 
                            catch (err) {
								utils.logError(err,req);
								if(err === "unauthorised") {									
                                	res.send(403);
								}
								else {								
                                	es.send(500);
								}                                
                            }
                        }
                    })
                    
                }
                else {
                    res.send(404);
                }
            }
        });
        
    } 
    catch (err) {
        utils.logError(err,req);
        res.send(500);
    }
})


server.post('/children/create', pre, function(req, res, next){
    try {
    
        mongoose.connect(utils.getConnection());        
        
        var child = new models.Child({
            firstName: req.params.firstName,
            middleName: req.params.middleName,
            lastName: req.params.lastName,
            pictureID: req.params.pictureID,
            dob: req.params.dob
        });
        
        child.useraccess.push(req.user_id);
        
        child.save(function(err){
            if (err) {
                utils.logError(err,req);
                res.send(500);
            }
            else {
                res.send(201, child);
            }
        })
    } 
    catch (err) {
        utils.logError(err,req);
        res.send(500);
    }
    
});

server.post('/users/create', function(req, res){
    try {
        mongoose.connect(utils.getConnection());
        var user = new models.User({
            email: req.params.email.toLowerCase(),
            password: password.hash(req.params.password),
            firstName: req.params.firstname,
            lastName: req.params.lastname,
        
        });
        
        user.save(function(e){
            if (e) {
                console.log(e);
                res.send(400, e);
            }
            else {
                res.send(201, user);
            }
        });
    } 
    catch (err) {
        utils.logError(err,req);
        res.send(500);
    }
    
    
});

server.post('/user-session/create', function(req, res){
    try {        
        mongoose.connect(utils.getConnection());
        models.User.findOne({
            email: req.params.email.toLowerCase()
        }, function(err, user){
            if (user && password.valid(req.params.password, user.password)) {
                var auth = utils.encrypt(JSON.stringify({
                    uid: user.id
                }));
                var expiresAt = new Date(new Date().setDate(new Date().getDate() + 365));
                utils.setAuthCookie(req, res, auth, expiresAt);
                res.send(200, user);
            }
            else {
                res.send(403);
            }
            
        });
    } 
    catch (err) {
        utils.logError(err,req);
        res.send(500);
    }
});

server.post('/user-session/end', function(req, res){
    try {
        var expiresAt = new Date(new Date().setDate(new Date().getDate() - 7));
        console.log(expiresAt);
        utils.setAuthCookie(req, res, "", expiresAt);
        res.send(200);
    } 
    catch (err) {
        utils.logError(err,req);
        res.send(500);
    }
});

server.post('/moment-image/create', pre, function(req, res){
    try {
    
        mongoose.connect(utils.getConnection());
        var image = new models.MomentImage({
            data: req.params.data,
            childID: req.params.cid
        })
        
        image.save(function(e){
            if (e) {
                utils.logError(err,req);
                res.send(500);
            }
            else {
                res.send(201, image._id);
            }
        });
        
    } 
    catch (err) {
        utils.logError(err,req);
        res.send(500);
    }
});


server.post('/moments/create', pre, function(req, res){
    try {
        var moment = req.params;
        mongoose.connect(utils.getConnection());
        models.Child.findById(moment.childID, function(err, child){
			try {
				child.createMoment(req.user_id, moment, function(err, newMoment){
	                if (err) {
	                    utils.logError(err,req);
	                    es.send(500);
	                }
	                else {
						var message = {
							description: newMoment.description,
							firstName: child.firstName,
							lastName: child.lastName,
							childId: child._id
						}
						
						var blacklist = []
												
						_.each(socket.clients, function(x) {
							if(_.indexOf(child.useraccess,x.user_id) == -1 || x.user_id  == req.user_id) {
								console.log("blacklisting " + x.sessionId);
								blacklist.push(x.sessionId);	
							}																			
						})
						
						
						console.log("sending message: " + message);
						socket.broadcast(message);
	                    res.send(201, newMoment);
	                }
            	});
			}
			catch(err) {
				utils.logError(err,req);
				if(err === "unauthorised") {									
                	res.send(403);
				}
				else {								
                	res.send(500);
				}   
			}
            
        });
    } 
    catch (err) {
        utils.logError(err,req);
        res.send(500);
    }
    
});


server.get('/moments/:childID', pre, function(req, res){
    try {
        var childID = req.uriParams.childID;
        mongoose.connect(utils.getConnection());
        
        models.Child.findById(childID, function(err, child){
            child.getMoments(req.user_id, function(err, moments){
                if (err) {
					utils.logError(err,req);
					if(err === "unauthorised") {									
                		res.send(403);
					}
					else {								
	                	res.send(500);
					}                       
                }
                else {
                    res.send(200, moments);
                }
            })
        });
        
    } 
    catch (err) {
        utils.logError(err,req);
        res.send(500);
    }
    
    
});

server.get('/moment-image/:imageID/download/:cookie', function(req, res){
	try {
		var userAuth = JSON.parse(utils.decrypt(req.uriParams.cookie));
		req.user_id = userAuth.uid;
		
		mongoose.connect(utils.getConnection());
		models.MomentImage.findById(req.uriParams.imageID, function(err, image){
			if (err) {
				utils.logError(err,req);
				res.send(500);
			}
			else {
				models.Child.findById(image.childID, function(err, child){
					try {
						child.execIfUserHasAuth(req.user_id, function(){
							var decodedBuffer = new Buffer(image.data, "base64");
							res.send({
								code: 200,
								headers: {
									'Content-Type': 'image/png',
									'Content-Length': decodedBuffer.length,
									'Content-Disposition': 'attachment; filename=image_' + image._id
								},
								noEnd: true
							});
							
							res.write(decodedBuffer, 'binary');
							res.end();
						});
					} 
					catch (e) {
						utils.logError(err,req);
						if (err === "unauthorised") {
							res.send(403);
						}
						else {
							res.send(500);
						}
					}
				});
			}
		});
	}
	catch (err) {
        utils.logError(err,req);
		res.send(500);
    }
});



server.get('/moment-image/:imageID', pre, function(req, res){
    try {
        console.log("moment-image/" + req.uriParams.imageID);
        mongoose.connect(utils.getConnection());
        
        models.MomentImage.findById(req.uriParams.imageID, function(err, image){
            if (err) {                
                utils.logError(err,req);
				res.send(500);
            }
            else {
                models.Child.findById(image.childID, function(err, child){
                    try {
                        child.execIfUserHasAuth(req.user_id, function(){
                            var decodedBuffer = new Buffer(image.data, "base64");
                            res.send({
                                code: 200,
                                headers: {
                                    'Content-Type': 'image/png',
                                    'Content-Length': decodedBuffer.length
                                },
                                noEnd: true
                            });
                            
                            res.write(decodedBuffer, 'binary');
                            res.end();
                        });
                    } 
                    catch (err) {
                        utils.logError(err,req);
						if(err === "unauthorised") {									
		                	res.send(403);
						}
						else {								
		                	res.send(500);
						}   
                    }
                });
            }
            
        });
    } 
    catch (err) {
        utils.logError(err,req);
        res.send(500);
    }
    
});

var channels = [];

server.listen(utils.getPort());
console.log('Server running on ' + (utils.getPort()));

var connectionCount = 0;

var socket = io.listen(server);

socket.on("connection", function(client){
	connectionCount++;	
	console.log("current connection count:" +  connectionCount);	
	
	client.on('message', function(message){
		var userAuth = JSON.parse(utils.decrypt(message));
		client.user_id = userAuth.uid;
		console.log("user authoised on socket.io: " + client.user_id);				
	 })
	 
	client.on('disconnect', function(){ 
		connectionCount--;
		console.log("current connection count:" +  connectionCount);
	}) 	
})


