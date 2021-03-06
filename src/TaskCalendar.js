function TaskCalendar() {
  // TaskCalendar object constructor
  
  // array dayTasks will contain matrix [month][day] containing array of tasks for each specific day (if any)
  this.dayTasks = [[],[],[],[],[],[],[],[],[],[],[],[]];
  
  for (var m = 0; m < 12;m++) 
  // IMPORTANT: there are 32 items on [day] dimension, that's because 
  //  - item #0 is ignored and won't be processed - days are indexed 1-31, so zero is not used (unlike months, which are indexed 0-11)
  //  - we assume each month has 31 days, for months, where there are less real days, than 31, tasks occuring on non-existing days will be processed specially 
    this.dayTasks[m] = [[],
                        [],[],[],[],[],[],[],[],[],[],
                        [],[],[],[],[],[],[],[],[],[],
                        [],[],[],[],[],[],[],[],[],[],[]];
  
  // how many day there are in each calendar month?
  this.monthDays = [31,28,31,30,31,30,31,31,30,31,30,31];
  
  // leap year handling
  var d = new Date();
  // check if 200 days in the future is already leap year 
  // (as there is only 12 months considered in this algorithm this should be sufficient)
  // makes no sense checking if the current year is leap year as calculating days in December 
  // would result in wrong calculation of the coming February  
  d.setDate(d.getDate()+200); 
  if (leapYear(d.getFullYear()))
    this.monthDays[1] = 29;
  
  // caching time zone offset string for faster processing    
  this.TZoffset = tzOffsetString();
  
  this.localeDateFormat = "1"; // date format - default is "old"
  this.localeWeekStartsOn = "S"; //weeks starts on "Sunday" by default, but "M" for "Monday" is possible too
  
  this.appendRecPattern = false;

}

//--------------------------------------------------
TaskCalendar.prototype.setLocale = function(ws, dtfmt) {
  this.localeWeekStartsOn = ws;
  this.localeDateFormat = dtfmt;
}

//--------------------------------------------------
TaskCalendar.prototype.appendPattern = function(a) {
  this.appendRecPattern = a;
}

//--------------------------------------------------
TaskCalendar.prototype.setLogLevel = function(a) {
  this.logLevel = a;
}



//--------------------------------------------------
TaskCalendar.prototype.copyTask = function(task) {
  // simple function creating simplified copy of a Task object
  var t = {};
  
  t.title = task.title;
  t.notes = task.notes;
  t.due = task.due;
  t.subtasks = task.subtasks;
  
  return t;
}

//--------------------------------------------------
TaskCalendar.prototype.alignMonthDays = function(m, dom) {
  // based on provided month and day-of-month function returns
  // day-of-month value if day-of-month does not exceeds number of days in specified month
  // otherwise it returns the last day of specified month
  
  var d;
  
  m = m % 12; // just in case
      
  if (dom > this.monthDays[m]) 
    d = this.monthDays[m]
  else
    d = dom;

  return d;
}

//--------------------------------------------------
TaskCalendar.prototype.createTasks_DoM = function(task, rS, rE) {
  //create "Day of Month recurrence" task occurences
  //params:
  //   task - task
  //   rangeStart, rangeEnd - start and end date for data range to be considered

  var rangeStart = (task.recDef.recStart.date > rS ? new Date(task.recDef.recStart.date.getTime()) : new Date(rS.getTime()));
  var rangeEnd = new Date(rE.getTime());

  //var y = rangeStart.getFullYear();
  var y = task.recDef.recStart.date.getFullYear();
  
  // if recurrence started in the previous years, then the first month of occurence is now
  // if recurrence started this year, then take first month from recurrence start date
  //var m = (task.recDef.recStart.date.getFullYear() < y)? rangeStart.getMonth():task.recDef.recStart.date.getMonth();
  var m = task.recDef.recStart.date.getMonth();
  var d = this.alignMonthDays(m, task.recDef.monthly.day);
  var t;
  var tlog = "";
  if (this.logLevel >= LOG_TRACE){
    tlog = "\nDebug:";
  }
  
  if (rangeEnd > task.recDef.recEnd.date) 
    rangeEnd = task.recDef.recEnd.date; // do not calculate behind the recurrence validity end
  
  var dt = new Date(y, m, d, 0, 0, 0, 0);
  logIt(LOG_DEV, '    >>> First occurence will be on m=%s, dt=%s', m, dt);
  if (this.logLevel >= LOG_TRACE){
    tlog += "\n1st m="+m+" dt="+dt.toISOString();
  }
  
  while (dt < rangeStart) {
    m += task.recDef.frequency;
    d = this.alignMonthDays(m % 12, task.recDef.monthly.day);    
    dt = new Date(y, m, d, 0, 0, 0, 0);
  }
  logIt(LOG_DEV, '    >>> First occurence after adjustment is on m=%s, dt=%s', m, dt);
  if (this.logLevel >= LOG_TRACE){
    tlog += "\n1adj m="+m+" dt="+dt.toISOString();
  }
  
  
  while (dt <= rangeEnd) {
    t = this.copyTask(task);
    t.due = date2rfc3339(dt, this.TZoffset); //Google Tasks require due date to be written in rfc3339 format
    t.due2msec = dt.getTime(); //secondary due date kept for further internal processing
    
    logIt(LOG_DEV, '    >>> Creating instance %s ** %s/%s', dt, m, d);
    if (this.logLevel >= LOG_TRACE){
      tlog += "\ninst m="+m+" dt="+t.due;
    }
    
    t.notes += tlog;
    this.dayTasks[m % 12][d].push(t); //append to the end 
    
    m += task.recDef.frequency;
    d = this.alignMonthDays(m % 12, task.recDef.monthly.day);
    dt = new Date(y, m, d, 0, 0, 0, 0);

  }
  
}

//--------------------------------------------------
TaskCalendar.prototype.createTasks_DoY = function(task, rS, rE) {
  //create "Date of Year recurrence" task occurences
  //params:
  //   task - task
  //   rS, rE - start and end date for data range to be considered

  var rangeStart = (task.recDef.recStart.date > rS ? new Date(task.recDef.recStart.date.getTime()) : new Date(rS.getTime()));
  var rangeEnd = new Date(rE.getTime());

  var y = task.recDef.recStart.date.getFullYear();
  var m = task.recDef.yearly.month % 12;
  var d = this.alignMonthDays(m, task.recDef.yearly.day);
  var t;
  var tlog = "";
  if (this.logLevel >= LOG_TRACE){
    tlog = "\nDebug:";
  }

  
  if (rangeEnd > task.recDef.recEnd.date) 
    rangeEnd = task.recDef.recEnd.date; // do not calculate behind the recurrence validity end
  
  var dt = new Date(rangeStart.getTime());
  dt.setTime(task.recDef.recStart.date.getTime());
  logIt(LOG_DEV, '    >>> First occurence will be on %s', dt);
  if (this.logLevel >= LOG_TRACE){
    tlog += "\n1st dt="+dt.toISOString();
  }
  
  dt.setDate(this.alignMonthDays(task.recDef.yearly.month % 12, task.recDef.yearly.day));
  logIt(LOG_DEV, '    >>> First occurence adj#1 on %s', dt);  
  if (this.logLevel >= LOG_TRACE){
    tlog += "\n1adj dt="+dt.toISOString();
  }
   
  dt.setMonth(task.recDef.yearly.month % 12);
  logIt(LOG_DEV, '    >>> First occurence adj#2 on %s', dt);      
  if (this.logLevel >= LOG_TRACE){
    tlog += "\n2adj dt="+dt.toISOString();
  }
  
  while (dt < rangeStart) {
    y += task.recDef.frequency;
    dt.setFullYear(y);
  }
  logIt(LOG_DEV, '    >>> First occurence adj#3 on %s', dt);  
  if (this.logLevel >= LOG_TRACE){
    tlog += "\n3adj dt="+dt.toISOString();
  }
  
  
  while (dt <= rangeEnd) {
    t = this.copyTask(task);
    t.due = date2rfc3339(dt, this.TZoffset); //Google Tasks require due date to be written in rfc3339 format
    t.due2msec = dt.getTime(); //secondary due date kept for further internal processing
    
    if (this.logLevel >= LOG_TRACE){
      tlog += "\ninst m="+m+" dt="+t.due;
    }
    
    t.notes += tlog;
    logIt(LOG_DEV, '    >>> Creating instance %s ** %s/%s', dt, m, d);
    
    this.dayTasks[m][d].push(t); //append to the end 
    
    y += task.recDef.frequency;
    dt.setFullYear(y);
  }
  
}

//--------------------------------------------------
TaskCalendar.prototype.createTasks_DAY = function(task, rS, rE) {
  //create "Every X days recurrence" task occurences
  //params:
  //   task - task
  //   rS, rE - start and end date for data range to be considered
  
  var rangeStart = (task.recDef.recStart.date > rS ? new Date(task.recDef.recStart.date.getTime()) : new Date(rS.getTime()));
  var rangeEnd = new Date(rE.getTime());
  
  var d = (rangeStart.getTime() - task.recDef.recStart.date.getTime()) / 86400000; //difference in miliseconds to days
  d = Math.floor(d % task.recDef.frequency); // number of days since last calculated occurence rounded to WHOLE days
  var m;
  var t;
  var tlog = "";
  if (this.logLevel >= LOG_TRACE){
    tlog = "\nDebug:";
  }  
  
  if (rangeEnd > task.recDef.recEnd.date) 
    rangeEnd = task.recDef.recEnd.date; // do not calculate behind the recurrence validity end
  
  var dt = new Date(rangeStart.getTime());
  dt.setHours(0,0,0,0);
  logIt(LOG_DEV, '    >>> First occurence will be on %s', dt);
  if (this.logLevel >= LOG_TRACE){
    tlog += "\n1st dt="+dt.toISOString();
  }  
  
  dt.setDate(dt.getDate() - d); // date of the previous occurence
  logIt(LOG_DEV, '    >>> First occurence adj#1 on %s', dt);  
  if (this.logLevel >= LOG_TRACE){
    tlog += "\nadj1 dt="+dt.toISOString();
  }  
  
  if (dt < rangeStart) // if outside the range, then add one occurence
    dt.setDate(dt.getDate() + task.recDef.frequency);
  logIt(LOG_DEV, '    >>> First occurence adj#2 on %s', dt);
  if (this.logLevel >= LOG_TRACE){
    tlog += "\nadj2 dt="+dt.toISOString();
  }  
  
  
  while (dt <= rangeEnd) {
    t = this.copyTask(task);
    t.due = date2rfc3339(dt, this.TZoffset); //Google Tasks require due date to be written in rfc3339 format
    t.due2msec = dt.getTime(); //secondary due date kept for further internal processing
    
    d = dt.getDate();
    m = dt.getMonth();
    
    if (this.logLevel >= LOG_TRACE){
      tlog += "\ninst dt="+t.due;
    }
    
    t.notes += tlog;
    logIt(LOG_DEV, '    >>> Creating instance %s ** %s ** %s/%s', dt, t.due, m, d);
    this.dayTasks[m][d].push(t); //append to the end 
    
    dt.setDate(dt.getDate()+task.recDef.frequency);
  }
  
}

//--------------------------------------------------
TaskCalendar.prototype.createTasks_DoW = function(task, rS, rE) {
  //create "Every X weeks on specified days" task occurences
  //params:
  //   task - task
  //   rS, rE - start and end date for data range to be considered
  
  var weekMS = 7 * 86400000; // milliseconds in a week
  
  var tlog = "";
  if (this.logLevel >= LOG_TRACE){
    tlog = "\nDebug:";
  }
  
  // make sure recStart is the first day of week
  task.recDef.recStart.date.setDate(task.recDef.recStart.date.getDate()-task.recDef.recStart.date.getDay());
  
  //if week starts on Monday, then let's move to Monday
  if (this.localeWeekStartsOn == "M") 
    task.recDef.recStart.date.setDate(task.recDef.recStart.date.getDate() + 1);
  
  var rangeStart = (task.recDef.recStart.date > rS ? new Date(task.recDef.recStart.date.getTime()) : new Date(rS.getTime()));
  logIt(LOG_DEV, '    >>> DoW#00 rangeStart, recStart: %s,%s', rangeStart, task.recDef.recStart.date);
  var rangeEnd = new Date(rE.getTime());
  
  var d = (rangeStart.getTime() - task.recDef.recStart.date.getTime()) / weekMS; //difference in miliseconds to weeks
  logIt(LOG_DEV, '    >>> DoW#01 d, floor(d), frequency: %s,%s,%s', d, Math.floor(d % task.recDef.frequency), d % task.recDef.frequency);
  d = Math.floor(d % task.recDef.frequency); // number of weeks since last calculated occurence rounded to WHOLE weeks
  var m;
  var w;
  
  var dt = new Date(rangeStart.getTime());
  dt.setHours(0,0,0,0);
  logIt(LOG_DEV, '    >>> First occurence will be on %s', dt);
  if (this.logLevel >= LOG_TRACE){
    tlog += "\n1st dt="+dt.toISOString();
  }  
  
  var eow = new Date(); // end of week
  
  logIt(LOG_DEV, '    >>> DoW#10 RangeEnd %s', rangeEnd);
  if (rangeEnd > task.recDef.recEnd.date) 
    rangeEnd = task.recDef.recEnd.date; // do not calculate behind the recurrence validity end
  logIt(LOG_DEV, '    >>> DoW#15 RangeEnd %s', rangeEnd);    
  
  dt.setDate(dt.getDate() - dt.getDay()); // the last Sunday (beginning of the week)
  logIt(LOG_DEV, '    >>> First occurence adj#1 on %s', dt);
  if (this.logLevel >= LOG_TRACE){
    tlog += "\nadj1 dt="+dt.toISOString();
  }    
  
  if (this.localeWeekStartsOn == "M") //if week starts on Monday, then let's move to Monday
    dt.setDate(dt.getDate() + 1);
  logIt(LOG_DEV, '    >>> First occurence adj#2 on %s', dt);  
  if (this.logLevel >= LOG_TRACE){
    tlog += "\nadj2 dt="+dt.toISOString();
  }    
  
  
  dt.setDate(dt.getDate() - (d*7)); // move weeks back to the past to when recurrence start was set
  logIt(LOG_DEV, '    >>> First occurence adj#3 on %s', dt);
  if (this.logLevel >= LOG_TRACE){
    tlog += "\nadj3 dt="+dt.toISOString();
  }    
  
  eow.setTime(dt.getTime() + weekMS-1 ); // end of week is beginning of week plus milliseconds of one week
  logIt(LOG_DEV, '    >>> DoW#30 eow %s', eow);
  
  if (eow < rangeStart) // if outside the range, then add one occurence
      dt.setDate(dt.getDate() + (task.recDef.frequency * 7));
  logIt(LOG_DEV, '    >>> First occurence adj#4 on %s', dt);
  if (this.logLevel >= LOG_TRACE){
    tlog += "\nadj4 dt="+dt.toISOString();
  }    
  
  while (dt <= rangeEnd) {
    logIt(LOG_DEV, '    >>> DoW#60 dt %s', dt);
    eow.setTime(dt.getTime() + weekMS-1 );
    
    for (i=0;i<7;i++) {
      
      if (dt >= rangeStart && dt <= rangeEnd) {
        if (task.recDef.weekly.days_of_week["S" == this.localeWeekStartsOn ? i : (i+1)%7]){  // as [0] is always Sunday, some calculation is needed for Monday starts
          t = this.copyTask(task);
          t.due = date2rfc3339(dt, this.TZoffset); //Google Tasks require due date to be written in rfc3339 format
          t.due2msec = dt.getTime(); //secondary due date kept for further internal processing
    
          d = dt.getDate();
          m = dt.getMonth();
          
          if (this.logLevel >= LOG_TRACE){
            tlog += "\ninst dt="+t.due;
          }
          
          t.notes += tlog;          
    
          logIt(LOG_DEV, '    >>> Creating instance %s ** %s ** %s/%s', dt, t.due, m, d);
          this.dayTasks[m][d].push(t); //append to the end 
        }
      }
      
      dt.setDate(dt.getDate() + 1); // move to the next day
      
    }
    
    dt.setDate(dt.getDate()+7*(task.recDef.frequency-1)); //skip to the next frequency
  }
  
}

//--------------------------------------------------

TaskCalendar.prototype.processRecTasks = function (rTasks, rangeStart, rangeEnd) {
  // process all tasks from a specified task list and enter them into specified task calendar object
  //
  // rTasks - array of tasks to be processed
  // rangeStart, rangeEnd - date range for which tasks will be created
  
  var parser = new Record_Parser();
  
  parser.setWeekStart(this.localeWeekStartsOn);
  parser.setDateFmt(this.localeDateFormat);
  
  logIt(LOG_EXTINFO,'  > Parser Fmt %s, %s', parser.locFmt.weekStartsOn, this.localeWeekStartsOn);
  
  var n, i, ii;
    
  if (rTasks.length == 0) {
    logIt(LOG_INFO,'  > No tasks found in the task list.');
    return;
  }
  
  for (var i = 0; i < rTasks.length; i++) {
    var t = new RecurrentTask("no title");
    parser.err.reset();
    t.title = rTasks[i].title;
    t.notes = rTasks[i].notes;
    t.subtasks = [].concat(rTasks[i].subtasks);
    t.recDef.setDateFmt(this.localeDateFormat);
    t.recDef.setWeekStart(this.localeWeekStartsOn);
    
    logIt(LOG_EXTINFO,'  > Task "%s"', t.title);
    
      
    n = t.notes;
    // scan notes lines to find one containing recurrency pattern definition
    // and parse only if recurrency definition was found
    if (n && (ii = n.search(parser.sx_recordId_RGT[0])) >= 0 ) {
    
      //recurrence pattern found in notes -> cut it out from notes
      t.notes = n.slice(0,ii);
      n = n.slice(ii);
      ii = n.search(/\n/);
      if (ii > 0) {
        t.notes += n.slice(ii+1);
        n = n.slice(0,ii);
      }

      if (this.appendRecPattern){
        logIt(LOG_DEV, '    >> appending to notes "%s"', n);
        t.notes += '\n\n'+n; //append recurrence pattern to the end of the notes
      }
      //logIt(LOG_DEV, '    >> appending id to notes %s',rTasks[i].id);
      //t.notes +=  ('\n@ID:'+rTasks[i].id); //append recurrent task id to the end of task notes

      logIt(LOG_DEV, '    >> to be parsed #1 "%s"', n);

      parser.doParse(n,t.recDef); 

      if (parser.err.code != parser.PARSE_OK){
        logIt(LOG_WARN,'  > Task parsing error - task ignored "%s"', t.title);
        logIt(LOG_DEV,'    >> Status: %s, %s', parser.err.code, parser.err.text);
      } else {
        
        //logIt(LOG_DEV, '    >> parsed "%s"', JSON.stringify(t.recDef));
        
        // if no recurrency start date defined, then let it be January 1st, 2000
        if (t.recDef.recStart.date == null) 
          t.recDef.recStart.date = new Date(2000, 0, 1);

        // if no recurrency end date defined, then let it be January 1st, 3000
        if (t.recDef.recEnd.date == null) 
          t.recDef.recEnd.date = new Date(3000, 0, 1);
          
        // if task validity falls inside daterange to be generated, then let's generate instances of it
        if ((t.recDef.recStart.date <= rangeEnd) && ( rangeStart <= t.recDef.recEnd.date)){
          logIt(LOG_DEV, '  >> notes="%s"',t.notes);
          this.createTasks(t, rangeStart, rangeEnd);
        } else {
          logIt(LOG_DEV, '    >> out of range VS: %s VE: %s', t.recDef.recStart.date, t.recDef.recEnd.date); 
        }
      }
         
    } else 
      logIt(LOG_EXTINFO, '    >> not parsed - missing recurrency pattern');
  } 
  
}

//--------------------------------------------------
TaskCalendar.prototype.createTasks = function(rTask, rangeStart, rangeEnd) {
  // process specific recurrent task, analyze recurrency pattern and create simple tasks based on the recurrency pattern
  // supported patterns:
  //   DOM - monthly on specific day of a month (parameters: DD {day of a month})
  //   DOY - yearly on specific day of a year (parameters: MM/DD {month of a year}/{day of a month})
  //   DAY - daily every X day (parameters: none)
  //   DOW - weekly on specified days (parameters: string containing days of week 1-Sunday, ..., 6-Saturday, e.g. 134 = Sunday, Tuesday, Wednesday)
  var p1, p2
  
  logIt(LOG_DEV, '    >> Processing %s',rTask.title);
  
  if (rTask.recDef.frequency > 1 && rTask.recDef.recStart.date == null)
    logIt(LOG_WARN, '    >> Start date for task having frequency > 1 not specified - task deadline might be calculated wrongly');
    
  if (rTask.recDef.recStart.date <= rangeEnd && rTask.recDef.recEnd.date >= rangeStart) {
    switch (rTask.recDef.recType) {
      case "D":
        this.createTasks_DAY(rTask, rangeStart, rangeEnd);
        break;
      case "W":
        this.createTasks_DoW(rTask, rangeStart, rangeEnd);
        break;
      case "M":
        this.createTasks_DoM(rTask, rangeStart, rangeEnd);
        break;
      case "Y":
        this.createTasks_DoY(rTask, rangeStart, rangeEnd);
        break;
      default:
        logIt(LOG_EXTINFO, '    >> unknown rectype', 1);
    } 
  } else
    logIt(LOG_EXTINFO, '    >> out of range - skipping (VS) %s (VE) %s (RS) %s (RE) %s', rTask.recDef.recStart.date, rTask.recDef.recEnd.date, rangeStart, rangeEnd);
  
}

TaskCalendar.prototype.saveTaskWithSubTasks = function(task, taskListId) {
  var ts = task.subtasks.sort(function(a,b){return a.position>b.position?1:-1;});
  var tn = safeTaskInsert(task, taskListId, {});
  if (tn && ts){
    var subTask;
    for (var i=0;i<ts.length;i++) {
      if (ts[i]) {
        var ns = {
          parent: tn.id,
          due: tn.due,
          title: ts[i].title,
          position: ts[i].position,
          notes: ts[i].notes
        }
        subTask = safeTaskInsert(ns,taskListId,{parent:tn.id, previous:subTask?subTask.id:null});
      }
    }
  }
  return tn;
}

//--------------------------------------------------
TaskCalendar.prototype.saveAllTasks = function(taskListId, rangeStart, rangeEnd) {
  // method saves ALL tasks stored in array dayTasks into specified Google Apps task list
  // the assumption is, that all irrelevant tasks have been removed from dayTasks array
  
  var y, m, d, i;
  var task;
  var count = 0;
  
  // save/insert all tasks from dayTasks array to specified Google tasks list
  for (m = 0; m < 12; m++){
    logIt(LOG_EXTINFO, '  > Saving month %s', ((m+1)|0));     
    for (d = 1; d <= this.monthDays[m]; d++) {
      if  (this.dayTasks[m][d].length > 0) {
        logIt(LOG_EXTINFO, '  > Day %s has %s tasks, %s', (d|0), this.dayTasks[m][d].length);
        for (i = 0; i < this.dayTasks[m][d].length; i++) {
          task = this.saveTaskWithSubTasks(this.dayTasks[m][d][i], taskListId);
          count++;
          
          if (task)
            logIt(LOG_DEV, '  > Task saved: %s/%s %s ** %s', ((m+1)|0),(d|0),task.title, task.due);
          else
            logIt(LOG_CRITICAL, '  > Task NOT saved: %s/%s %s ** %s', ((m+1)|0),(d|0),this.dayTasks[m][d][i].title, this.dayTasks[m][d][i].due);
          
          Utilities.sleep(gTaskQTime); // artificial pause to manage API quota          
        }
      } else {
        //logIt(LOG_DEV, '  > Nothing to save for %s', ((d)|0));
      }
      
    }
  }
  
}

//--------------------------------------------------
TaskCalendar.prototype.removeDuplicatesFromArray = function(gTasks) {
  // process all tasks in gTasks and remove all tasks from dayTasks array
  // which have the same title and are due on the same date as any task from gTasks
  
  if (gTasks.length > 0) {
    for (var i = 0; i < gTasks.length; i++) {
      var task = gTasks[i];
      var title = gTasks[i].title;
      var dt = new Date(gTasks[i].due); //TIMEZONE?
      if (dt) {
        //logIt(LOG_DEV, '  >> Removing duplicates for %s, %s, %s, %s', title, dt, gTasks[i].due,gTasks[i].deleted );
        this.removeDuplicatesFromDayTasks(title, dt); //remove tasks from specific date
      }
    }
  } else 
    logIt(LOG_EXTINFO, '  >> OK, no tasks found for deduplication.');
  
}

//--------------------------------------------------
TaskCalendar.prototype.removeDuplicatesFromDayTasks = function(title, dt) {
  // remove all tasks having specified title from specified date
  var m = dt.getMonth();
  var d = dt.getDate();
  var f = 0;
  var l = this.dayTasks[m][d].length; // number of entries for that day before deduplication
  
  //logIt(LOG_DEV, '  >>> List for %s/%s contains %s entries',m+1,d,this.dayTasks[m][d].length);
  //logIt(LOG_DEV, '  >>> Entries %s',this.dayTasks[m][d]);

  if (this.dayTasks[m][d].length > 0){
    this.dayTasks[m][d] = this.dayTasks[m][d].filter(function(itm){ return itm.title != title });
    
    if (l > this.dayTasks[m][d].length)
      logIt(LOG_DEV, '  >>> Removed %s duplicates from month/day %s/%s',l-this.dayTasks[m][d].length, m, d);    
  }
    
  //for (var i=0;i < this.dayTasks[m][d].length; i++) {
  //  if (this.dayTasks[m][d][i].title == title){ // && (this.dayTasks[m][d][i].due2msec == dt.getTime()) 3.9.15 removed condition for duetime
  //    this.dayTasks[m][d].splice(i,1);
  //    f++; //found +1
  //  }
  //}
  
  //logIt(LOG_DEV, '  >>> New entries %s',this.dayTasks[m][d]);
  
}