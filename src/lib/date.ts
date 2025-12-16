export function todayYMD() {
    return new Intl.DateTimeFormat("en-CA", { year:"numeric", month:"2-digit", day:"2-digit" }).format(new Date());
  }
  
  // Monday-start week range for a given YYYY-MM-DD
  export function weekRange(day: string) {
    const d = new Date(day + "T00:00:00");
    const dow = d.getDay(); // 0 Sun..6 Sat
    const diffToMon = (dow === 0 ? -6 : 1 - dow);
  
    const mon = new Date(d);
    mon.setDate(d.getDate() + diffToMon);
  
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
  
    const fmt = (x: Date) =>
      new Intl.DateTimeFormat("en-CA", { year:"numeric", month:"2-digit", day:"2-digit" }).format(x);
  
    return { start: fmt(mon), end: fmt(sun), mon };
  }
  