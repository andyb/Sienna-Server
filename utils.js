var cf = require("cloudfoundry"), crypto = require("crypto"), Cookies = require( "cookies" );

var mongoConfig = cf.mongodb['siennadb'] ||
{
    credentials: {
        username: "admin",
        password: "password",
        hostname: "localhost",
        port: 27017,
        db: "siennadb"
    },
};


var utils = {
	logError: function(ex,req) {
		console.log("Exception: " + ex + " req:" + req.url);
	},
	getConnection: function(){
        return "mongodb://" + mongoConfig.credentials.username + ":" + mongoConfig.credentials.password + "@" + mongoConfig.credentials.hostname + ":" + mongoConfig.credentials.port + "/" + mongoConfig.credentials.db;
    },    
	getPort: function(){
		return process.env.VMC_APP_PORT || 80;
	},
	encrypt: function(text) {
		var cipher = crypto.createCipher('aes-256-cbc',key)
		var crypted = cipher.update(text,'utf8','hex')
		crypted += cipher.final('hex')
		return crypted;
	},
	decrypt: function(encryptedText) {
		var decipher = crypto.createDecipher('aes-256-cbc',key)
		var decrypted = decipher.update(encryptedText,'hex','utf8')
		decrypted += decipher.final('utf8')
		return decrypted;
	},
	getAuthCookie : function(req, res) {
		var cookies = new Cookies( req, res);
		return cookies.get("sienna");
	},
	setAuthCookie : function(req, res, value, expiresAt) {
		var cookies = new Cookies( req, res );
		cookies.set( "sienna", value, { signed: false, httpOnly: false, expires: expiresAt } )
	}
}

var key = '07moq09zrty2009';

module.exports = utils;