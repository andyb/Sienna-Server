var mongoose = require('mongoose');
var Schema = mongoose.Schema, ObjectId = Schema.ObjectId;

function toLower (v) {
  return v.toLowerCase();
}

var User = new Schema({
    email     : { type: String, unique: true, required: true, set: toLower }
  , password      : { type: String, required: true }
  , firstName     : { type: String, required: true }
  , lastName      : { type: String, required: true }
  , createdAt : { type: Date, default: Date.now }
  , lastUpdatedAt : { type: Date, default: Date.now }
});

var Moment = new Schema({	
	description : { type: String, required: true }
	, imageID : String
	, createdAt : { type: Date, default: Date.now }
	, lastUpdatedAt : { type: Date, default: Date.now }
	, childID : { type: String, required: true }
	, createdBy : { 
					name : String,
					uid : String
				}
})

var Child = new Schema({ 
  firstName     : { type: String, required: true }
  , middleName     : String
  , lastName      : { type: String, required: true }
  , imageID 	  : String
  , dob           : Date    
  , createdAt : { type: Date, default: Date.now }
  , lastUpdatedAt : { type: Date, default: Date.now }
  , useraccess : [String]
});


var MomentImage = new Schema({		
	data : String,
	childID : String
});


mongoose.model('User', User)
mongoose.model('Child', Child)
mongoose.model('Moment', Moment)
mongoose.model('MomentImage', MomentImage)

exports.User = mongoose.model('User');
exports.Child = mongoose.model('Child');
exports.Moment = mongoose.model('Moment');
exports.MomentImage = mongoose.model('MomentImage');

/* model methods */

exports.Child.prototype.getMoments = function(uid, callback) {
		if(this.useraccess.indexOf(uid) >=0) {
			mongoose.model('Moment').find({
		            "childID": this._id
		        }, [], {
		            sort: {
		                createdAt: -1
		            }
		        }, callback);
		}	
		else {
			callback("unauthorised",null);
		}						
	};
	
exports.Child.prototype.createMoment = function(uid, moment, callback) {
	if (this.useraccess.indexOf(uid) >= 0) {
		var newMoment = new exports.Moment({
			description: moment.description,
			createdAt: moment.createdAt,
			childID: this._id,
			imageID: moment.imageID,
			createdBy: {
				name: moment.name,
				uid: moment.uid
			}
		});		
		
		newMoment.save(function(err) {
			callback(err,newMoment);
		});
	} else {
			callback("unauthorised",null);
		}	
	        
	};
	
exports.Child.prototype.execIfUserHasAuth = function(uid, callback) {
		if(this.useraccess.indexOf(uid) >=0) {
			callback();			
		}	
		else {
			throw("unauthorised");
		}						
	};

