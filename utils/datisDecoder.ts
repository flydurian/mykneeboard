/**
 * DATIS (Digital Automatic Terminal Information Service) Decoder
 * Based on FAA AIM 7-1-9 and standard aviation phraseology.
 */

export interface DatisDecodedInfo {
    // Header
    airport?: string;
    infoLetter?: string;
    infoTime?: string; // Zulu time

    // Weather
    wind?: string;
    visibility?: string;
    weather?: string[]; // Rain, Snow, etc.
    clouds?: string[];
    temperature?: string;
    dewpoint?: string;
    altimeter?: string; // Both inHg and hPa if available

    // Runway / Approach Info
    approaches?: string[];
    departures?: string[];
    runwayConditions?: string[]; // Wet, Ice, etc.

    // NOTAMs / Status
    closedRunways?: string[];
    closedTaxiways?: string[];
    notams?: string[]; // General NOTAMs and OTS info

    // Remarks / Advisories
    advisories?: string[]; // Bird activity, construction, etc.
    remarks?: string[]; // Raw decoded remarks

    // Raw
    rawText: string;
}

/**
 * Normalizes DATIS text for easier parsing.
 */
function normalizeText(text: string): string {
    return text
        .replace(/\n/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase()
        .replace(/\bRY\b/g, 'RWY')
        .replace(/\bRWYS\b/g, 'RWY')
        .replace(/\bAPCH\b/g, 'APPROACH')
        .replace(/\bAPP\b/g, 'APPROACH')
        .replace(/\bAPCHS\b/g, 'APPROACHES')
        .replace(/\bDEPG\b/g, 'DEPARTURES')
        .replace(/\bDEP\b/g, 'DEPARTURE')
        .replace(/\bTWY\b/g, 'TAXIWAY')
        .replace(/\bCLSD\b/g, 'CLOSED')
        .replace(/\bBTN\b/g, 'BETWEEN')
        .replace(/\bCTC\b/g, 'CONTACT')
        .replace(/\bGC\b/g, 'GROUND CONTROL')
        .replace(/\bNAV\b/g, 'NAVIGATION')
        .replace(/\bINOP\b/g, 'INOPERATIVE')
        .replace(/\bOTS\b/g, 'OUT OF SERVICE')
        .replace(/\bU\/S\b/g, 'UNSERVICEABLE');
}

/**
 * Parses wind information including gusts and variable directions.
 * Format: DDDSSKT, DDDSSGGGKT, VRBSSKT
 */
function parseWind(text: string): string | undefined {
    // Match: 3 digits (dir) + 2-3 digits (speed) + optional G + 2-3 digits (gust) + KT
    // Or: VRB + 2-3 digits (speed) + ...
    const windMatch = text.match(/\b(VRB|[0-9]{3})([0-9]{2,3})(?:G([0-9]{2,3}))?KT\b/);

    if (windMatch) {
        const dir = windMatch[1];
        const speed = parseInt(windMatch[2], 10);
        const gust = windMatch[3] ? parseInt(windMatch[3], 10) : null;

        let windStr = '';
        if (dir === 'VRB') {
            windStr = `Variable at ${speed} knots`;
        } else {
            windStr = `${dir}° at ${speed} knots`;
        }

        if (gust) {
            windStr += `, gusting to ${gust} knots`;
        }

        // Check for variable direction (e.g., 180V240)
        const varMatch = text.match(/\b([0-9]{3})V([0-9]{3})\b/);
        if (varMatch) {
            windStr += ` (Variable between ${varMatch[1]}° and ${varMatch[2]}°)`;
        }

        return windStr;
    }

    if (text.includes('CALM')) return 'Calm';

    return undefined;
}

/**
 * Parses visibility.
 * Format: 10SM, M1/4SM, 1 1/2SM, etc.
 */
function parseVisibility(text: string): string | undefined {
    // Match P6SM, M1/4SM, 1/2SM, 1 1/2SM, 10SM
    const visMatch = text.match(/\b(P|M)?([0-9\s\/]+)SM\b/);

    if (visMatch) {
        const prefix = visMatch[1]; // P (Plus) or M (Minus)
        const value = visMatch[2].trim();

        let visStr = '';
        if (prefix === 'P') visStr = 'Greater than ';
        if (prefix === 'M') visStr = 'Less than ';

        visStr += `${value} statute miles`;
        return visStr;
    }

    // Check for CAVOK (Ceiling and Visibility OK)
    if (text.includes('CAVOK')) return '10km or more (CAVOK)';

    return undefined;
}

/**
 * Parses sky conditions (clouds).
 * Format: FEW020, SCT050, BKN250, OVC100, VV002, CLR, SKC
 */
function parseClouds(text: string): string[] {
    const clouds: string[] = [];

    // Standard cloud layers
    const cloudRegex = /\b(FEW|SCT|BKN|OVC)([0-9]{3})(?:CB|TCU)?\b/g;
    let match;
    while ((match = cloudRegex.exec(text)) !== null) {
        const type = match[1];
        const height = parseInt(match[2], 10) * 100;
        const modifier = match[0].includes('CB') ? ' (Cumulonimbus)' :
            match[0].includes('TCU') ? ' (Towering Cumulus)' : '';

        const typeMap: { [key: string]: string } = {
            'FEW': 'Few clouds',
            'SCT': 'Scattered clouds',
            'BKN': 'Broken clouds',
            'OVC': 'Overcast'
        };

        clouds.push(`${typeMap[type]} at ${height.toLocaleString()} ft${modifier}`);
    }

    // Vertical Visibility (Obscured sky)
    const vvMatch = text.match(/\bVV([0-9]{3})\b/);
    if (vvMatch) {
        const height = parseInt(vvMatch[1], 10) * 100;
        clouds.push(`Vertical visibility ${height} ft`);
    }

    // Clear skies
    if (/\b(CLR|SKC)\b/.test(text)) {
        clouds.push('Sky clear');
    }

    if (text.includes('CAVOK')) {
        clouds.push('No significant clouds (CAVOK)');
    }

    return clouds;
}

/**
 * Parses temperature and dewpoint.
 * Format: 20/15, M02/M05
 */
function parseTempDew(text: string): { temp?: string, dew?: string } {
    const match = text.match(/\b(M?[0-9]{2})\/(M?[0-9]{2})\b/);
    if (match) {
        const parseVal = (s: string) => {
            if (s.startsWith('M')) return -parseInt(s.substring(1), 10);
            return parseInt(s, 10);
        };

        return {
            temp: `${parseVal(match[1])}°C`,
            dew: `${parseVal(match[2])}°C`
        };
    }
    return {};
}

/**
 * Parses altimeter setting.
 * Format: A2992, Q1013
 */
function parseAltimeter(text: string): string | undefined {
    const aMatch = text.match(/\bA([0-9]{4})\b/);
    const qMatch = text.match(/\bQ([0-9]{4})\b/);

    const parts: string[] = [];

    if (aMatch) {
        const val = parseInt(aMatch[1], 10) / 100;
        parts.push(`${val.toFixed(2)} inHg`);
    }

    if (qMatch) {
        const val = parseInt(qMatch[1], 10);
        parts.push(`${val} hPa`);
    }

    return parts.length > 0 ? parts.join(' / ') : undefined;
}

/**
 * Parses active approaches.
 * Handles complex lists like "ILS RY 24R AND 25L", "CHARTED VISUAL FMS BRIDGE".
 */
function parseApproaches(text: string): string[] {
    const approaches: string[] = [];

    // Split text into sentences to isolate approach instructions
    const sentences = text.split('.');

    for (const sentence of sentences) {
        const clean = sentence.trim();
        if (!clean) continue;

        // Check if sentence contains approach keywords
        if (clean.includes('APPROACH') || clean.includes('APCH') || clean.includes('APP')) {
            // 1. Check for specific named visual approaches first (SFO examples)
            const visualMatches = clean.match(/(CHARTED VISUAL [A-Z\s]+|QUIET BRIDGE|TIPP TOE|FMS BRIDGE)/g);
            if (visualMatches) {
                visualMatches.forEach(match => approaches.push(`${match.trim()} Approach`));
            }

            // 2. Check for standard instrument approaches
            // Pattern: (ILS|RNAV|GPS|RNP) ... RWY (XX, XX, AND XX)
            // We want to capture the whole phrase like "ILS RY 24R" or "RNAV RNP APCHS RY 24R AND 25L"

            // Strategy: Extract the runways involved first
            const rwyMatch = clean.match(/(?:RWY|RY|RWYS)\s+([0-9]{2}[LRC]?)(?:\s+(?:AND|OR|,)\s+([0-9]{2}[LRC]?))*/);

            if (rwyMatch) {
                // If runways are found, try to identify the type of approach associated with them
                let type = 'Instrument';
                if (clean.includes('ILS')) type = 'ILS';
                else if (clean.includes('RNAV') && clean.includes('RNP')) type = 'RNAV (RNP)';
                else if (clean.includes('RNAV')) type = 'RNAV';
                else if (clean.includes('GPS')) type = 'GPS';
                else if (clean.includes('VISUAL')) type = 'Visual';

                // Extract all runways mentioned in this context
                const runways: string[] = [];
                const rwyRegex = /([0-9]{2}[LRC]?)/g;
                let m;
                // Search only within the relevant part of the sentence to avoid picking up unrelated numbers
                const rwyPart = clean.substring(clean.indexOf('RWY') || clean.indexOf('RY'));
                while ((m = rwyRegex.exec(rwyPart)) !== null) {
                    runways.push(m[1]);
                }

                if (runways.length > 0) {
                    if (clean.includes('SIMUL')) {
                        approaches.push(`Simultaneous ${type} Approaches to Runways ${runways.join(', ')}`);
                    } else {
                        approaches.push(`${type} Approach to Runway${runways.length > 1 ? 's' : ''} ${runways.join(', ')}`);
                    }
                } else {
                    // Fallback: just add the sentence if it seems relevant but parsing failed
                    approaches.push(clean);
                }
            } else if (clean.includes('VISUAL APCH')) {
                // General visual approach instruction
                if (clean.includes('VCTR')) approaches.push('Vectors for Visual Approach');
                else approaches.push(clean);
            }
        }
    }

    return [...new Set(approaches)];
}

/**
 * Parses active departures.
 */
function parseDepartures(text: string): string[] {
    const departures: string[] = [];
    const sentences = text.split('.');

    for (const sentence of sentences) {
        const clean = sentence.trim();
        if (clean.includes('DEPARTURE') || clean.includes('DEPG')) {
            // Handle "SIMUL INSTR DEPARTURES IN PROG RWYS 24 AND 25"
            if (clean.includes('SIMUL')) {
                const runways = clean.match(/([0-9]{2}[LRC]?)/g);
                if (runways) {
                    departures.push(`Simultaneous Instrument Departures: Runways ${runways.join(', ')}`);
                    continue;
                }
            }

            // Handle "DEPG RWYS 1L, 1R"
            if (clean.includes('DEPARTURES') || clean.includes('DEPARTURE') || clean.includes('DEPG')) {
                const runways = clean.match(/([0-9]{1,2}[LRC]?)/g);
                if (runways) {
                    departures.push(`Runways: ${runways.join(', ')}`);
                    continue;
                }
            }

            departures.push(clean);
        }
    }

    return [...new Set(departures)];
}

/**
 * Parses NOTAMs and closed facilities.
 * Handles complex closures like "TWY A CLSD BTN TWY F AND TWY A2".
 */
function parseNotams(text: string): { closedRunways: string[], closedTaxiways: string[], notams: string[] } {
    const closedRunways: string[] = [];
    const closedTaxiways: string[] = [];
    const notams: string[] = [];

    const sentences = text.split('.');

    for (const sentence of sentences) {
        const clean = sentence.trim();
        if (!clean) continue;

        // Taxiways (Check before Runways to avoid misclassification if a taxiway closure mentions a runway)
        if ((clean.includes('TAXIWAY') || clean.includes('TWY')) && (clean.includes('CLOSED') || clean.includes('CLSD'))) {
            // Handle "TWY A CLSD BTN TWY F AND TWY A2"
            if (clean.includes('BTN') || clean.includes('BETWEEN')) {
                // Capture the full context of the closure
                // Regex to capture "TWY [Name] CLSD BTN [Loc1] AND [Loc2]"
                // Use greedy match to capture the full description until the end of the sentence
                const complexMatch = clean.match(/(?:TWY|TAXIWAY)\s+([A-Z0-9]+)\s+(?:CLSD|CLOSED)\s+(?:BTN|BETWEEN)\s+(.+)/);
                if (complexMatch) {
                    closedTaxiways.push(`Taxiway ${complexMatch[1]} Closed Between ${complexMatch[2]}`);
                } else {
                    // Fallback for complex sentences
                    closedTaxiways.push(clean);
                }
            } else {
                const match = clean.match(/(?:TWY|TAXIWAY)\s+([A-Z0-9]+)/);
                if (match) {
                    closedTaxiways.push(`Taxiway ${match[1]} Closed`);
                } else {
                    notams.push(clean);
                }
            }
        }
        // Runways
        else if ((clean.includes('RWY') || clean.includes('RY')) && (clean.includes('CLOSED') || clean.includes('CLSD'))) {
            // Check for specific "CLOSED TO LANDING" or "CLOSED TO TAKEOFF"
            const specificClosure = clean.match(/(?:RWY|RY)\s+([0-9]{1,2}[LRC]?)\s+CLSD\s+(?:TO\s+)(LANDING|TAKEOFF)/);
            if (specificClosure) {
                closedRunways.push(`Runway ${specificClosure[1]} Closed to ${specificClosure[2]}`);
                continue;
            }

            const match = clean.match(/(?:RWY|RY)\s+([0-9]{1,2}[LRC]?)/);
            if (match) {
                closedRunways.push(`Runway ${match[1]} Closed`);
            } else {
                notams.push(clean);
            }
        }
        // Other NOTAM keywords
        else if (
            clean.includes('OUT OF SERVICE') ||
            clean.includes('UNSERVICEABLE') ||
            clean.includes('OTS') ||
            clean.includes('WORK IN PROGRESS') ||
            clean.includes('NOTAM') ||
            clean.includes('CRANE') ||
            clean.includes('U/S')
        ) {
            // Expand abbreviations
            let expanded = clean
                .replace(/\bOTS\b/g, 'Out of Service')
                .replace(/\bU\/S\b/g, 'Unserviceable');
            notams.push(expanded);
        }
    }

    return { closedRunways, closedTaxiways, notams };
}

/**
 * Main decoding function.
 */
export function decodeDatis(rawText: string): DatisDecodedInfo {
    const normalized = normalizeText(rawText);

    // Header Info (INFO X XXXXZ)
    const infoMatch = normalized.match(/INFO\s+([A-Z])\s+([0-9]{4})Z/);
    const infoLetter = infoMatch ? infoMatch[1] : undefined;
    const infoTime = infoMatch ? infoMatch[2] : undefined;

    // Weather components
    const wind = parseWind(normalized);
    const visibility = parseVisibility(normalized);
    const clouds = parseClouds(normalized);
    const { temp, dew } = parseTempDew(normalized);
    const altimeter = parseAltimeter(normalized);

    // Operations
    const approaches = parseApproaches(normalized);
    const departures = parseDepartures(normalized);

    // NOTAMs
    const { closedRunways, closedTaxiways, notams } = parseNotams(normalized);

    // Advisories (subset of NOTAMs/Remarks)
    const advisories: string[] = [];

    // Scan full text for advisories to catch long sentences
    const sentences = normalized.split('.');
    for (const s of sentences) {
        const clean = s.trim();
        if (clean.includes('BIRD ACTIVITY')) advisories.push(clean);
        if (clean.includes('LAHSO')) advisories.push('Land and Hold Short Operations in effect');
        if (clean.includes('LOW LEVEL WIND SHEAR')) advisories.push('Low Level Wind Shear Advisories in effect');
        if (clean.includes('RUNWAY INCURSIONS')) advisories.push(clean); // Capture full warning
        if (clean.includes('HAZD WX') || clean.includes('HAZARDOUS WEATHER')) advisories.push(clean);
        if (clean.includes('READBACK')) advisories.push(clean); // "READBACK ALL HOLD SHORT INSTRUCTIONS"
    }

    return {
        airport: undefined, // Usually passed from outside or parsed if available
        infoLetter,
        infoTime,
        wind,
        visibility,
        clouds,
        temperature: temp,
        dewpoint: dew,
        altimeter,
        approaches,
        departures,
        closedRunways,
        closedTaxiways,
        notams,
        advisories: [...new Set(advisories)], // Deduplicate
        rawText
    };
}

/**
 * Formats the decoded info into a readable string array.
 */
export function formatDatisInfo(decoded: DatisDecodedInfo): string {
    const lines: string[] = [];

    if (decoded.infoLetter && decoded.infoTime) {
        lines.push(`ATIS Information ${decoded.infoLetter} (${decoded.infoTime}Z)`);
        lines.push('');
    }

    // Weather Block
    lines.push('--- Weather ---');
    if (decoded.wind) lines.push(`Wind: ${decoded.wind}`);
    if (decoded.visibility) lines.push(`Visibility: ${decoded.visibility}`);
    if (decoded.clouds && decoded.clouds.length > 0) lines.push(`Sky: ${decoded.clouds.join(', ')}`);
    if (decoded.temperature && decoded.dewpoint) lines.push(`Temp/Dew: ${decoded.temperature} / ${decoded.dewpoint}`);
    if (decoded.altimeter) lines.push(`Altimeter: ${decoded.altimeter}`);
    lines.push('');

    // Operations Block
    if (decoded.approaches && decoded.approaches.length > 0) {
        lines.push('--- Approaches ---');
        decoded.approaches.forEach(a => lines.push(a));
        lines.push('');
    }

    if (decoded.departures && decoded.departures.length > 0) {
        lines.push('--- Departures ---');
        decoded.departures.forEach(d => lines.push(d));
        lines.push('');
    }

    // NOTAMs Block
    const allNotams = [
        ...(decoded.closedRunways || []),
        ...(decoded.closedTaxiways || []),
        ...(decoded.notams || [])
    ];

    if (allNotams.length > 0) {
        lines.push('--- NOTAMs & Status ---');
        allNotams.forEach(n => lines.push(n));
        lines.push('');
    }

    // Advisories
    if (decoded.advisories && decoded.advisories.length > 0) {
        lines.push('--- Advisories ---');
        decoded.advisories.forEach(a => lines.push(a));
    }

    return lines.join('\n');
}
