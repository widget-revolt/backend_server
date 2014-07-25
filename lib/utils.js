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

var ERR_OK = "ok";
var ERR_INVALID_PARAM = "err_invalid_param";
var ERR_GENERAL = "err_general";

function formatResponse(status, errDesc, data)
{
	var paramErrDesc = errDesc || "";
	var paramData = data || "";

	return(
	{
		"result": status,
		"err_desc": paramErrDesc,
		"data" : paramData
	});
}

/*
// takes a list of get params.  Returns error response or null if ok
function validateRequiredParams(paramList, requestParams)
{
	var len = paramList.length;
	for(var i = 0; i < len; i++)
	{
		var paramName = paramList[i];
		if(!requestParams.hasOwnProperty(paramName)) {
	    	return(formatResponse(ERR_INVALID_PARAM, "missing param:" + paramName, ""));
    	}
	}

	// returns null if ok
	return null;	
}
*/


function Validate_Params(query, params, res)
{
	var missingFields = '';

	params.forEach(function(param){
		if(!query.hasOwnProperty(param)) {
			missingFields += param + ' ';
		}
	});

	if(missingFields != '')
	{
		res.send({result: ERR_INVALID_PARAM,
					 msg: 'missing ' + missingFields});
		return false;
	}

	return true;
}

function isEmptyString(s)
{
	if(!s) {
		return true;
	}
	if(s === "") {
		return true;
	}
	//You could also check whitespace..I don't care

	return false;
}

function safeTrim(s, defaultVal)
{
	var theDefault = defaultVal || "";
	if(!s) {
		return theDefault;
	}

	var retVal = s.trim();
	return retVal;

}

function roundTo2Decimals(numberToRound) {
	return Math.round(numberToRound * 100) / 100;
}



module.exports =
{
	ERR_OK: 				ERR_OK,
	ERR_INVALID_PARAM: 		ERR_INVALID_PARAM,	//
	ERR_GENERAL: 			ERR_GENERAL,
	validateRequiredParams: Validate_Params,
	formatResponse: 		formatResponse,
	safeTrim:				safeTrim,
	isEmptyString:			isEmptyString,
	roundTo2Decimals:    	roundTo2Decimals
};
