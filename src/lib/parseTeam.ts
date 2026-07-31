/** Parse pasted team text into structured data.
 *  Handles labelled formats (Team/Leader/Phone/Player keywords) and fallback heuristic (plain list). */
export function parseTeamPaste(text: string): { teamName: string; phone: string; captain: string; players: string[] } | null {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return null;

  const stripSep = (s: string) => s.replace(/^[\-–:：]\s*/, '').trim();
  const normalizePhone = (s: string) => { const d = s.replace(/\D/g, ''); return d.length > 10 ? d.slice(-10) : d; };
  const isPhone = (s: string) => { const d = s.replace(/\D/g, ''); return d.length >= 7 && d.length <= 15 && /^\d+$/.test(d); };
  const splitOrAlts = (s: string) => s.split(/\s+or\s+/i).map(p => p.trim()).filter(Boolean);

  // ── PASS 1: Labelled lines ──
  let teamName = '', phone = '', captain = '';
  const players: string[] = [];
  let labeledHits = 0, hasStructuredLabel = false, afterPlayerNameLabel = false;

  for (const line of lines) {
    const mTeam = line.match(/^(?:[Tt]eam\s+[Nn]ame|[Tt]eam|[Ss]quad|[Cc]lan)\s*[-–:：]?\s+(.+)$/u);
    if (mTeam) { teamName = stripSep(mTeam[1].trim()); labeledHits++; afterPlayerNameLabel = false; continue; }

    const mLeader = line.match(/^(?:[Ll]eader['\u2019s]*|[Cc]aptain)\s+(?:[Nn]ame\s*)?(.+)$/u);
    if (mLeader) {
      let raw = stripSep(mLeader[1].trim()).replace(/^[Nn]ame\s*[-\u2013:\uff1a]?\s*/, '');
      if (!/^[Pp]h(?:one?|n)/i.test(raw) && !/^[Nn]ame\s*$/.test(raw) && raw !== '') {
        const alts = splitOrAlts(raw);
        captain = alts[0];
        alts.slice(1).forEach(p => { if (!isPhone(p)) players.push(p); });
        labeledHits++; hasStructuredLabel = true; afterPlayerNameLabel = false; continue;
      }
    }

    const mPhone = line.match(/^(?:[Ll]eader['\u2019s]*\s+)?[Pp]h(?:one?|n)\s*(?:[Nn]umber)?\s*[-\u2013:\uff1a]?\s*(.+)$/u);
    if (mPhone) {
      const raw = stripSep(mPhone[1].trim());
      if (isPhone(raw)) { phone = normalizePhone(raw); labeledHits++; hasStructuredLabel = true; afterPlayerNameLabel = false; continue; }
    }

    const mPlayerName = line.match(/^[Pp]layer\s+[Nn]ame\s*[-–:：]\s+(.+)$/u);
    if (mPlayerName) {
      const first = mPlayerName[1].trim();
      if (first && !isPhone(first)) splitOrAlts(first).forEach(p => players.push(p));
      labeledHits++; hasStructuredLabel = true; afterPlayerNameLabel = true; continue;
    }

    const mPlayer = line.match(/^[Pp]layers?\s*(?:\d+\s*[.\-\s]*)?(.+)$/u);
    if (mPlayer) {
      const raw = stripSep(mPlayer[1].trim());
      if (!raw || isPhone(raw)) { afterPlayerNameLabel = true; continue; }
      splitOrAlts(raw).filter(p => !isPhone(p)).forEach(p => { players.push(p); labeledHits++; hasStructuredLabel = true; });
      afterPlayerNameLabel = true; continue;
    }

    if (afterPlayerNameLabel) {
      const stripped = line.replace(/^[-–]\s*/, '').trim();
      if (stripped && !isPhone(stripped) && !/^[Tt]eam|^[Ll]eader|^[Cc]aptain|^[Pp]h/u.test(line)) {
        splitOrAlts(stripped).forEach(p => { players.push(p); labeledHits++; });
        continue;
      }
    }

    if (!phone && isPhone(line)) { phone = normalizePhone(line); labeledHits++; afterPlayerNameLabel = false; }
  }

  if (labeledHits >= 2 && hasStructuredLabel) {
    const allPlayers = captain ? [captain, ...players.filter(p => p !== captain)] : players;
    return { teamName, phone, captain: captain || allPlayers[0] || '', players: allPlayers };
  }

  // ── PASS 2: Fallback heuristic ──
  const stripBullet = (s: string) => s.replace(/^(?:\(?#?\d+[\.)\-]?\)?\s*)/u, '').trim();
  const isHeader = (s: string) => /^(?:[Pp]layers?|[Rr]oster|[Mm]embers?|[Ss]quad|[Ll]eader|[Cc]aptain)\s*[:：\-]?\s*$/.test(s);

  let fbTeamName = '', fbPhone = '', fbCaptain = '';
  const fbPlayers: string[] = [];

  for (const line of lines) {
    if (isHeader(line)) continue;
    if (!fbTeamName && fbPlayers.length === 0 && fbCaptain === '') { fbTeamName = line; continue; }
    if (!fbPhone && isPhone(line)) { fbPhone = normalizePhone(line); continue; }
    const name = stripBullet(line) || line;
    if (!fbCaptain) { fbCaptain = name; fbPlayers.push(name); } else fbPlayers.push(name);
  }

  const fbFinalPlayers = [...new Set(fbPlayers)];
  if (!fbTeamName && !fbFinalPlayers.length) return null;
  return { teamName: fbTeamName, phone: fbPhone, captain: fbCaptain, players: fbFinalPlayers };
}
