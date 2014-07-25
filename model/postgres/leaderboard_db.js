//
//	Copyright (c) 2014 Widget Revolt LLC.  All rights reserved
//
//	Permission is hereby granted, free of charge, to any person obtaining a copy
//	of this software and associated documentation files (the "Software"), to deal
//	in the Software without restriction, including without limitation the rights
//	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
//	copies of the Software, and to permit persons to whom the Software is
//	furnished to do so, subject to the following conditions:
//
//	The above copyright notice and this permission notice shall be included in
//	all copies or substantial portions of the Software.
//
//	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
//	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
//	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
//	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
//	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
//	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
//	THE SOFTWARE.


"use strict";
var util = require('util');

var ServerConfig = require("../../config").ServerConfig;
var PG = require('pg');
if(ServerConfig.DEPLOY_ENVIRONMENT != "development") {
	PG = require('pg').native;
}

var S = require('string');

var LEADERBOARD_CONFIG = require("../../config").LEADERBOARD_CONFIG;

var Logger = require("../../log").getLogger();
var Utils = require("../../lib/utils.js");
var QueryHelpers = require('./query_helpers.js');

///////////////////////////////////////////////////////
//Implements a simple leaderboard system that can be used to lookup high scores per level.  It relies on clients not sending every score and only sending a players best score.  It is also designed for a level based game where we want to have scores for each level and be able to see best friend scores on each level.
//
//For scaling, it uses a local "cache" for the global high scores that refreshes every NN minutes.  This will of course not work well if you have multiple instances/cores so it needs to get migrated to a real caching solution if the volume becomes heavy enough.


///////////////////////////////////////////////////////
// Const


///////////////////////////////////////////////////////
// Forward Exports
exports.createInstance = function(inName, inConnectString)
{
	LOGINFO("=== POSTGRES LeaderboardDB ===");

	var retObj = new LeaderboardDB(inName, inConnectString);
	return retObj;
};



///////////////////////////////////////////////////////
function LeaderboardDB(inName, inConnectString)
{
	this._mName = inName;
	this._mConnectString = inConnectString;

	//TODO: use a real cache - otherwise this will not scale as we add front-ends
	this._mHighScoresCache = {};
	this._mLastUpdateHighScoreCache = 0;

	// update hash
	var self = this;
	self.updateGlobalHighScores(function(err, result) {});

}
//-----------------------------------------------------
LeaderboardDB.prototype.getGlobalLeaders = function(inAppId, callback)
{
	//NOTE: we ignore the app id for now in our 1db:1app world

	var self = this;

	// update high scores
	self.updateGlobalHighScores(function(err, result) {

		// we dont care about the result err or otherwise... we're gonna pass back the cache result
		var resultObject = self._mHighScoresCache;
		callback(null, resultObject);

	});//updateGlobalHighScores()
};

//-----------------------------------------------------
LeaderboardDB.prototype.getFriendLeaders = function(appId, userUUID, leaderboardId, facebookFriendList, gamekitFriendList, callback)
{
	var self = this;

	// parse out the fb and gk friend lists into arrays
	var fbFriendArray = [];
	var gkFriendArray = [];

	if(!S(facebookFriendList).isEmpty()) {
		fbFriendArray = facebookFriendList.split(",");
	}

	if(!S(gamekitFriendList).isEmpty()) {
		gkFriendArray = gamekitFriendList.split(",");
	}

	// limit the count to 50 for each
	fbFriendArray = fbFriendArray.splice(0,50);
	gkFriendArray = gkFriendArray.splice(0,50);

	// if no items then bail with error
	if(fbFriendArray.length == 0 && gkFriendArray == 0) {

		callback("no argument list", null);
		return;
	}

	PG.connect(self._mConnectString, function(err, client, done) {

		if(err) {
			LOGERROR("Error connecting leaderboard");
			callback(err, null);
			return;
		}

		// base query
		var queryStr = "select u.uuid, u.gamecenter_id, u.gamecenter_alias, u.fbid, u.fname, u.lname, s.leaderboard_id, s.score from users u, scores s where u.uuid = s.user_uuid AND s.leaderboard_id=$1 AND s.app_id = $2 AND (%s) order by s.score desc";

		var queryParams = [leaderboardId, appId];


		// generate the facebook where in/clause
		var whereInQuery = "";
		if(fbFriendArray.length > 0)
		{
			var fbWhereInQuery = QueryHelpers.makeWhereInClause("u.fbid", queryParams.length+1, fbFriendArray);
			queryParams = queryParams.concat(fbFriendArray);
			whereInQuery = whereInQuery + fbWhereInQuery;
		}

		// generate the gamekit where/in clause
		var gkWhereInQuery = "";
		if(gkFriendArray.length > 0) {
			gkWhereInQuery = QueryHelpers.makeWhereInClause("u.gamecenter_id", queryParams.length + 1, gkFriendArray);
			queryParams = queryParams.concat(gkFriendArray);
			if(whereInQuery.length > 0) {
				whereInQuery = whereInQuery + " OR ";
			}
			whereInQuery = whereInQuery + gkWhereInQuery;
		}

		// and finalize the query str
		queryStr = util.format(queryStr, whereInQuery);

		client.query(queryStr, queryParams, function(err, result) {

			//call `done()` to release the client back to the pool
			done();

			if(err) {
				callback(err, null);
				return;
			}

			// done
			var resultObj = {
				"scores": result.rows
			};

			callback(err, resultObj);

		});//query()

	});//connect()


};

//-----------------------------------------------------
// This query comes from here:
//	http://stackoverflow.com/questions/22752427/max-and-distinct-sql-query
//
// in raw form:
//	select uuid, leaderboard_id, score
//	from (select u.uuid, s.leaderboard_id, s.score,
//		row_number() over (partition by s.leaderboard_id order by s.score desc) as seqnum
//	from users u, scores s
//	where u.uuid = s.user_uuid) gr
//	where seqnum = 1
//	order by leaderboard_id;
//

LeaderboardDB.prototype.updateGlobalHighScores = function(callback)
{
	var self = this;

	// check the last refresh date
	var refreshTimeout = LEADERBOARD_CONFIG["refresh_timeout"] || 1800000;
	var curTime = new Date();
	curTime = curTime.getTime();

	// dont refresh if it hasn't been long enough
	if(curTime < (self._mLastUpdateHighScoreCache + refreshTimeout)) {
		callback(null, {});
		return;
	}

	PG.connect(self._mConnectString, function(err, client, done) {

		if(err) {
			LOGERROR("Error connecting leaderboard");
			callback(err, null);
			return;
		}

		// query #1: find best score for this level
		var queryStr = "select uuid, leaderboard_id, score, fname, lname, gamecenter_alias from (select u.uuid, u.gamecenter_alias, u.fname, u.lname, s.leaderboard_id, s.score, row_number() over (partition by s.leaderboard_id order by s.score desc) as seqnum from users u, scores s where u.uuid = s.user_uuid) gr where seqnum = 1 order by leaderboard_id;";


		var queryParams = [];


		client.query(queryStr, queryParams, function(err, result) {

			//call `done()` to release the client back to the pool
			done();

			if(err) {
				callback(err, null);
				return;
			}

			var scoreHash = {};

			result.rows.forEach(function(row) {
				var leaderboardId = row["leaderboard_id"];
				var uuid = row["uuid"];
				var score = row["score"];
				var fname = row["fname"];
				var lname = row["lname"];
				var gamecenter_alias = row["gamecenter_alias"];

				scoreHash[leaderboardId] = {
					"uuid": uuid,
					"score": score,
					"fname": fname,
					"lname": lname,
					"gamecenter_alias": gamecenter_alias
				};

			});

			// save the hash
			var now = new Date();
			self._mHighScoresCache = scoreHash;
			self._mLastUpdateHighScoreCache = now.getTime();

			// done
			var resultObj = {};
			callback(err, resultObj);

		});//query()

	});//connect()
};

//-----------------------------------------------------
// inAppRequestName is is the request app (e.g. icetales, timewinder)
// inAppId should be a bundle identifier (e.g. com.widgetrevolt.icetaleshd)
LeaderboardDB.prototype.reportScore = function(inAppRequestName, inAppId, inLeaderboardId, inUserUUID, inScore, callback)
{
	// this code naively looks up the best current score and then only adds the new
	// score if better.  A better way would be to write all data and then run a continuous batch to
	// write new scores only if better
	var self = this;

	// make sure the score is a numeric
	var nScore = parseInt(inScore);

	PG.connect(self._mConnectString, function(err, client, done) {

		if(err) {
			LOGERROR("Error inserting in leaderboard");
			callback(err, null);
			return;
		}

		// query #1: find best score for this level
		var queryStr = "SELECT * FROM scores WHERE app=$1 AND app_id=$2 AND user_uuid=$3 AND leaderboard_id=$4 ORDER BY score DESC LIMIT 2;";
		var queryParams = [inAppRequestName, inAppId, inUserUUID, inLeaderboardId];

//queryStr = "SELECT * FROM scores LIMIT 2;";
//queryParams = [];
		client.query(queryStr, queryParams, function(err, result) {

			//call `done()` to release the client back to the pool
			done();

			if(err) {
				callback(err, null);
				return;
			}

			var hasScore = false;
			var bestScore = 0;
			if(result.rows.length > 0) {
				var scoreObj = result.rows[0];
				bestScore = scoreObj["score"];
				hasScore = true;
				LOGDEBUG(util.format("uuid: %s, level_id: %s, score: %d", inUserUUID, inLeaderboardId, bestScore));
			}

			var resultObj = {};

			if(nScore > bestScore)
			{
				// make a record object
				var recordObj = self.createScoreObject(inAppRequestName, inAppId, inLeaderboardId, inUserUUID, inScore);

				// insert or update
				if(hasScore) {
					self.updateScoreObject(recordObj, callback);
					//return
				}
				else {
					self.insertScoreObject(recordObj, callback);
					// returns
				}
			}
			else {
				callback(null, resultObj);
			}


		});//query()

	});//connect()
};
//--------------------------------------------------
// saves device info. Will insert or update depending on if exists
LeaderboardDB.prototype.insertScoreObject = function(scoreObject, callback)
{


	var qObj = createInsertUpdateQuery("INSERT", scoreObject);
	var queryStr = qObj["queryStr"];
	var queryParams = qObj["queryParams"];

	var self = this;
	QueryHelpers.upsertQuery(self._mConnectString, queryStr, queryParams, callback);
};
//--------------------------------------------------
// saves device info. Will insert or update depending on if exists
LeaderboardDB.prototype.updateScoreObject = function(scoreObject, callback)
{
	var qObj = createInsertUpdateQuery("UPDATE", scoreObject);
	var queryStr = qObj["queryStr"];
	var queryParams = qObj["queryParams"];

	var self = this;
	QueryHelpers.upsertQuery(self._mConnectString, queryStr, queryParams, callback);
};
//-----------------------------------------------------
LeaderboardDB.prototype.createScoreObject = function(inAppRequestName, inAppId, inLeaderboardId, inUserUUID, inScore)
{
	var nScore = parseInt(inScore);
	var retObject = {
		//uid
		//date_create

		"app": inAppRequestName,
		"app_id": inAppId,
		"user_uuid": inUserUUID,
		"leaderboard_id": inLeaderboardId,
		"score": nScore

	};
	return retObject;
};

///////////////////////////////////////////////////////
// Private Util Methods


//-----------------------------------------------------
function createInsertUpdateQuery(inType, scoreObject)
{
	/*
	 "app": inAppRequestName,
	 "app_id": inAppId,
	 "user_uuid": inUserUUID,
	 "leaderboard_id": inLeaderboardId,
	 "score": nScore
	 */
	var queryParams = [
		scoreObject.app,
		scoreObject.app_id,
		scoreObject.user_uuid,
		scoreObject.leaderboard_id,
		scoreObject.score
	];



	var queryStr;
	if(inType == "UPDATE")
	{
		queryStr = "UPDATE scores SET (date_create, score) = (now(), $5) WHERE app=$1 AND app_id=$2 AND user_uuid=$3 AND leaderboard_id=$4;";
	}
	else
	{
		queryStr = "INSERT INTO scores (date_create, app, app_id, user_uuid, leaderboard_id, score) "
			+ "VALUES (now(), $1, $2, $3, $4, $5);";
	}

	var retObj = {
		"queryStr":queryStr,
		"queryParams": queryParams
	};

	return retObj;

}

function LOGINFO(s) {
	Logger.info("Database", s);
}
function LOGDEBUG(s) {
	Logger.debug("Database", s);
}
function LOGERROR(s) {
	Logger.error("Database", s, false);
}

function LOGCRITICAL(s) {
	Logger.error("Database", s, true);
}
