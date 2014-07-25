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

var Logger = require("./log.js").getLogger();

//var dataModule = require('./model/data');
var DatabaseManager = require("./model/database_manager.js");

var StartOrder =
[
	{module: DatabaseManager, 			name: 'DatabaseManager', 			Get_Fn: DatabaseManager.sharedManager}
];

exports.Set_Title = function(processTitle)
{
	process.title = 'node: ' + processTitle;
};

exports.Start = function(processTitle, completionFn, errorFn)
{
	Logger.info('Startup', 'Starting up ' + processTitle);

	process.title = 'node: ' + processTitle;

	var World =
	{
		Data:			null,
		eoo:null
	};

	var nextModuleIndex = 0;

	function _Next(_resultType, lastModule)
	{
		var resultType = _resultType;

		return function(result, err)
		{
			if(resultType == 'error')
			{
				errorFn(result);
				return;
			}

			if(lastModule)
			{
				Logger.info('Startup', lastModule.name + ' loaded');

				World[lastModule.name] = lastModule.Get_Fn();
			}

			if(nextModuleIndex == StartOrder.length)
			{
				Logger.info('Startup', '----------------------------------');

				var waitingOnModules = 0;
				function _preFlightCompletion(name)
				{
					waitingOnModules++;
					return function()
					{
						Logger.info('Startup', name + ' Module Ready');

						if(!--waitingOnModules)
						{
							Logger.info('Startup', '...and away we go!');
							completionFn(World);
						}
					}
				}

				StartOrder.forEach(function(e){
					e.module.Pre_Flight(_preFlightCompletion(e.name));
				});
			}
			else
			{
				var nextModule = StartOrder[nextModuleIndex++];
				console.log(nextModule);

				nextModule.module.Start(_Next('success', nextModule), _Next('error'));
			}
		};
	}

	_Next('success', null)('success');
};













