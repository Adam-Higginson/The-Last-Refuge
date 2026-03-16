// crewManifest.ts — Hand-authored crew manifest for The Last Refuge.
// 50 crew members grouped by role, with ~130 authored relationships.
// Every player experiences the same rich social web.

import type { CrewRole, Trait, RelationshipType } from '../components/CrewMemberComponent';

export interface CrewDef {
    name: string;
    age: number;
    role: CrewRole;
    morale: number;
    traits: [Trait, Trait];
    backstory: string;
    isCaptain?: boolean;
}

export interface RelationshipDef {
    from: string;
    to: string;
    type: RelationshipType;
    level: number;
    descAB: string;
    descBA: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// CREW MANIFEST — 50 members
// ═══════════════════════════════════════════════════════════════════════════

export const CREW_MANIFEST: readonly CrewDef[] = [

    // ─── SOLDIERS (8) ───────────────────────────────────────────────────
    { name: 'Commander Soren Vael', age: 38, role: 'Soldier', morale: 55, traits: ['Stubborn', 'Resourceful'], backstory: 'Led the rearguard action during the Keth-7 evacuation, refusing to board until every civilian shuttle had launched. The Extiris bombardment scarred his left arm but not his resolve — he commandeered the ESV-7 from a dead captain\'s chair and flew them into the dark.', isCaptain: true },
    { name: 'Mira Chen', age: 22, role: 'Soldier', morale: 48, traits: ['Determined', 'Reckless'], backstory: 'Enlisted at sixteen when the Extiris occupation drafted her school into a labour battalion. She broke ranks during the evacuation to pull three children from a collapsed shelter, earning a field commission she never asked for.' },
    { name: 'Lt. Desta Morrow', age: 29, role: 'Soldier', morale: 52, traits: ['Haunted', 'Empathetic'], backstory: 'Served as a garrison officer on Keth-7\'s northern perimeter when the Extiris broke through. She held the line for eleven hours so the evacuation convoys could pass — the screams from the ones who didn\'t make it still wake her at night.' },
    { name: 'Sgt. Kael Orin', age: 34, role: 'Soldier', morale: 60, traits: ['Protective', 'Stubborn'], backstory: 'A career soldier who swore an oath to protect the civilian population of Keth-7. When the Extiris demanded surrender, he smuggled weapons through the sewage tunnels. He would do it again without hesitation.' },
    { name: 'Cpl. Ren Vasik', age: 26, role: 'Soldier', morale: 45, traits: ['Quiet', 'Determined'], backstory: 'Grew up in the Keth-7 underground resistance, learning to move without sound and shoot without missing. He has never spoken about what the Extiris did to his family\'s settlement.' },
    { name: 'Pvt. Talia Doss', age: 20, role: 'Soldier', morale: 42, traits: ['Reckless', 'Hopeful'], backstory: 'The youngest soldier aboard — she lied about her age to join the evacuation defence. She believes they will find a world where children don\'t have to pick up weapons, and she will fight until they do.' },
    { name: 'Sgt. Marcus Webb', age: 41, role: 'Soldier', morale: 50, traits: ['Analytical', 'Protective'], backstory: 'Served three tours under Extiris occupation before the final assault on Keth-7. He has buried more friends than he can count and maps every corridor of the ESV-7 by habit, planning retreats that he hopes will never be needed.' },
    { name: 'Cpl. Asha Nkomo', age: 27, role: 'Soldier', morale: 58, traits: ['Empathetic', 'Resourceful'], backstory: 'Was a community mediator before the occupation forced her into militia service. She carries a medkit alongside her weapon because she has learned that holding someone\'s hand matters as much as covering fire.' },

    // ─── ENGINEERS (10) ─────────────────────────────────────────────────
    { name: 'Chief Lena Harsk', age: 44, role: 'Engineer', morale: 52, traits: ['Stubborn', 'Analytical'], backstory: 'Ran the Keth-7 orbital shipyard until the Extiris seized it for scrap. She dismantled her own station rather than let them have it, smuggling the fusion core onto the ESV-7. Every system on this ship answers to her, and she answers to no one lightly.' },
    { name: 'Tomás Reyes', age: 31, role: 'Engineer', morale: 55, traits: ['Resourceful', 'Hopeful'], backstory: 'Fixed water purifiers in the Keth-7 refugee camps for three years under occupation. He learned to make miracles from scrap and believes that if they can keep the engines running, they can find somewhere worth landing.' },
    { name: 'Petra Volkov', age: 36, role: 'Engineer', morale: 48, traits: ['Quiet', 'Determined'], backstory: 'Spent the occupation maintaining life support in the Keth-7 deep mines where the Extiris sent dissidents. She does not talk about what she saw down there, but she has never let a system fail on her watch.' },
    { name: 'Jin-Soo Park', age: 28, role: 'Engineer', morale: 60, traits: ['Analytical', 'Empathetic'], backstory: 'Was completing his engineering thesis when the Extiris invaded Keth-7. He repurposed his research on thermal dynamics to design the heat shielding that got the ESV-7 through the orbital blockade.' },
    { name: 'Davi Okafor', age: 33, role: 'Engineer', morale: 50, traits: ['Resourceful', 'Protective'], backstory: 'Promised his parents he would get his sister Sarai off Keth-7 alive. He traded his engineering skills to the resistance for two seats on the evacuation — then stayed up for forty hours keeping the life support running during launch.' },
    { name: 'Ines Bakker', age: 25, role: 'Engineer', morale: 62, traits: ['Hopeful', 'Reckless'], backstory: 'Youngest engineer in the Keth-7 power grid division before the Extiris shut it down. She hot-wired the ESV-7\'s secondary reactor during the escape — a move that should have killed her but instead saved fifty lives. She\'d do it again in a heartbeat.' },
    { name: 'Ruben Ashe', age: 39, role: 'Engineer', morale: 44, traits: ['Haunted', 'Stubborn'], backstory: 'Was aboard the evacuation shuttle that took fire leaving Keth-7. He watched the hull breach pull three people into vacuum before he could seal it. The nightmares come every night, but his hands still know how to fix what is broken.' },
    { name: 'Freya Lindqvist', age: 30, role: 'Engineer', morale: 57, traits: ['Determined', 'Quiet'], backstory: 'Specialised in structural engineering on Keth-7\'s colony domes. When the Extiris began demolishing them, she memorised every blueprint so the knowledge would survive even if the buildings did not.' },
    { name: 'Kofi Mensah', age: 42, role: 'Engineer', morale: 46, traits: ['Grieving', 'Resourceful'], backstory: 'Lost his wife in the Keth-7 bombardment — she was in the eastern district when the Extiris levelled it. He channels the grief into his work, rebuilding what was taken from him one circuit board at a time.' },
    { name: 'Yuki Tanaka', age: 27, role: 'Engineer', morale: 64, traits: ['Analytical', 'Hopeful'], backstory: 'Grew up fascinated by the Keth-7 transit systems, mapping their patterns like poetry. She sees the ESV-7 not as a prison but as a puzzle — every inefficiency is a chance to make something better for the people inside.' },

    // ─── MEDICS (5) ─────────────────────────────────────────────────────
    { name: 'Dr. Yael Chen', age: 51, role: 'Medic', morale: 50, traits: ['Protective', 'Analytical'], backstory: 'Ran the largest trauma centre on Keth-7 before the Extiris converted it into an interrogation facility. She smuggled medical supplies out for months before the resistance extracted her. Her daughter Mira is all she has left — she will protect this crew the way she could not protect her city.' },
    { name: 'Dr. Elias Croft', age: 45, role: 'Medic', morale: 47, traits: ['Empathetic', 'Haunted'], backstory: 'Treated Extiris torture victims in the Keth-7 underground clinics for years. He knows what cruelty looks like up close and carries it in the dark circles under his eyes. He still flinches at sudden noises, but his hands never shake when someone needs help.' },
    { name: 'Nurse Sable Wren', age: 32, role: 'Medic', morale: 55, traits: ['Hopeful', 'Protective'], backstory: 'Volunteered at the refugee triage stations on Keth-7 when she could have taken a seat on an earlier evacuation shuttle. She stayed because someone had to hold the dying and tell them it would be alright. She still believes it will be.' },
    { name: 'Medic Ravi Anand', age: 29, role: 'Medic', morale: 58, traits: ['Determined', 'Empathetic'], backstory: 'Was a field medic during the final battle for Keth-7, crawling through collapsing corridors to reach the wounded. He pulled seven people from the wreckage of Section Nine — and has never forgotten the ones he couldn\'t reach.' },
    { name: 'Dr. Oona Mäkelä', age: 38, role: 'Medic', morale: 52, traits: ['Analytical', 'Quiet'], backstory: 'Specialised in epidemiology on Keth-7, tracking the diseases that swept the overcrowded refugee sectors. She documents everything — infection rates, supply levels, crew health patterns — because data is the only defence against the chaos that took her world.' },

    // ─── SCIENTISTS (5) ─────────────────────────────────────────────────
    { name: 'Prof. Idris Konte', age: 56, role: 'Scientist', morale: 48, traits: ['Analytical', 'Stubborn'], backstory: 'Was Keth-7\'s foremost astrophysicist before the Extiris burned the university. He refused to share his navigation research with the occupiers and spent four years in hiding, calculating escape trajectories on smuggled paper. He believes survival requires intellect, not impulse.' },
    { name: 'Dr. Zara Patel', age: 34, role: 'Scientist', morale: 54, traits: ['Hopeful', 'Determined'], backstory: 'Led the planetary survey team that catalogued Keth-7\'s mineral reserves — data the Extiris later used to strip-mine the world. She carries the guilt of that knowledge and channels it into finding a planet they can protect this time.' },
    { name: 'Ling Zhao', age: 30, role: 'Scientist', morale: 60, traits: ['Quiet', 'Analytical'], backstory: 'Worked in Keth-7\'s atmospheric monitoring station, watching the air quality deteriorate as the Extiris industrialised the planet. She left her data logs buried in a sealed vault — a record for anyone who finds Keth-7 after them.' },
    { name: 'Nils Eriksen', age: 40, role: 'Scientist', morale: 44, traits: ['Grieving', 'Resourceful'], backstory: 'Lost his wife and daughter when the Extiris bombed the Keth-7 research quarter. He was off-site calibrating instruments and has never forgiven himself for not being there. His grief is a weight he carries into every equation.' },
    { name: 'Dr. Amara Diallo', age: 37, role: 'Scientist', morale: 56, traits: ['Empathetic', 'Hopeful'], backstory: 'Ran community science programmes for Keth-7\'s children during the occupation, teaching them to find wonder even in a world that had been taken from them. She believes that curiosity is the first step toward building something new.' },

    // ─── CIVILIANS (22) ─────────────────────────────────────────────────
    { name: 'Hana Ito', age: 19, role: 'Civilian', morale: 65, traits: ['Hopeful', 'Empathetic'], backstory: 'Was a schoolgirl on Keth-7 when the Extiris came. She spent three years helping younger children in the refugee shelters, learning to comfort others before she had time to process her own fear. She looks forward because looking back hurts too much.' },
    { name: 'Malik Sarr', age: 52, role: 'Civilian', morale: 40, traits: ['Grieving', 'Protective'], backstory: 'Lost his wife when the Extiris bombed the Keth-7 market district. He carried his son through the ruins for two days to reach the evacuation zone. Everything he does now is for Tomas — the boy is the only reason he still breathes.' },
    { name: 'Esme Hollis', age: 28, role: 'Civilian', morale: 55, traits: ['Resourceful', 'Determined'], backstory: 'Ran supply logistics for the Keth-7 resistance, moving food and medicine through Extiris checkpoints using forged manifests. She has a talent for making order from chaos and has not stopped since they left atmosphere.' },
    { name: 'Old Kaede Sato', age: 63, role: 'Civilian', morale: 48, traits: ['Quiet', 'Hopeful'], backstory: 'Remembers Keth-7 before the Extiris — the festivals, the orchards, the sound of children laughing in the commons. She tells stories of that world to anyone who will listen, because forgetting would be a second defeat.' },
    { name: 'Zeke Calloway', age: 35, role: 'Civilian', morale: 42, traits: ['Reckless', 'Stubborn'], backstory: 'Was imprisoned by the Extiris for inciting a riot on Keth-7. The resistance broke him out during the evacuation chaos. He does not trust authority — any authority — because the last government he trusted sold them to the Extiris in the first place.' },
    { name: 'Noor Farah', age: 24, role: 'Civilian', morale: 58, traits: ['Empathetic', 'Hopeful'], backstory: 'Worked as a translator in the Keth-7 refugee camps, bridging language barriers between displaced communities. She believes that understanding each other is the first step toward building something worth protecting.' },
    { name: 'Tomas Sarr Jr.', age: 18, role: 'Civilian', morale: 50, traits: ['Reckless', 'Determined'], backstory: 'Grew up in the shadow of the Extiris occupation, watching his father break a little more each day. He is angry and restless and desperate to prove he is more than a refugee — that the next world will be one they choose, not one they flee to.' },
    { name: 'Bea Morrow', age: 61, role: 'Civilian', morale: 45, traits: ['Grieving', 'Stubborn'], backstory: 'Buried her husband in the ruins of their Keth-7 home before the evacuation. She refused to leave without marking the grave. Her daughter Desta inherited her stubbornness — Bea considers that the only inheritance worth passing on.' },
    { name: 'Fen Xu', age: 26, role: 'Civilian', morale: 52, traits: ['Quiet', 'Analytical'], backstory: 'Worked in the Keth-7 census bureau, tracking population displacement under the occupation. He understands logistics the way others understand music — patterns emerge from numbers, and patterns keep people alive.' },
    { name: 'Joss Delacroix', age: 33, role: 'Civilian', morale: 47, traits: ['Haunted', 'Reckless'], backstory: 'Was on the same evacuation shuttle that took fire leaving Keth-7. He saw things in the decompression that no one should see. He drinks the ship\'s rationed alcohol when he can get it and picks fights when he cannot sleep.' },
    { name: 'Sarai Okafor', age: 30, role: 'Civilian', morale: 56, traits: ['Protective', 'Empathetic'], backstory: 'Escaped Keth-7 with her brother Davi after their parents refused to leave. She carries their last message on a data chip around her neck and volunteers for every community task because staying busy keeps the grief at arm\'s length.' },
    { name: 'Lev Petrov', age: 46, role: 'Civilian', morale: 43, traits: ['Stubborn', 'Determined'], backstory: 'Was a municipal administrator on Keth-7 who watched the Extiris dismantle every institution he had built. He believes efficiency is survival and has no patience for sentiment that wastes resources people need.' },
    { name: 'Priya Bhat', age: 23, role: 'Civilian', morale: 60, traits: ['Hopeful', 'Resourceful'], backstory: 'Apprenticed in the Keth-7 botanical gardens before the Extiris paved them over. She smuggled seed samples aboard the ESV-7 in her pockets and dreams of planting them in soil that has never known conquest.' },
    { name: 'Dex Roan', age: 39, role: 'Civilian', morale: 41, traits: ['Haunted', 'Quiet'], backstory: 'Worked the night shift at the Keth-7 communications relay, listening to distress signals from settlements the Extiris were burning. He could hear them die and could do nothing. The silence of space is a mercy he does not trust.' },
    { name: 'Calla Voss', age: 21, role: 'Civilian', morale: 63, traits: ['Hopeful', 'Reckless'], backstory: 'Fled Keth-7 holding Wren Gallagher\'s hand through a burning evacuation corridor. She laughs too loud and takes too many risks because every day they are alive is a day the Extiris did not win.' },
    { name: 'Obi Achebe', age: 48, role: 'Civilian', morale: 44, traits: ['Grieving', 'Empathetic'], backstory: 'Was a schoolteacher on Keth-7 who lost half his students when the Extiris closed the refugee schools. He teaches the children aboard the ESV-7 because knowledge is the one thing that cannot be bombed or burned or taken away.' },
    { name: 'Rosa Herrera', age: 55, role: 'Civilian', morale: 50, traits: ['Protective', 'Resourceful'], backstory: 'Led the food distribution network in the Keth-7 refugee camps, keeping thousands fed when the Extiris cut supply lines. She brought that same organisational instinct aboard the ESV-7 and has not stopped counting rations since.' },
    { name: 'Silas Kade', age: 32, role: 'Civilian', morale: 46, traits: ['Analytical', 'Quiet'], backstory: 'Maintained the Keth-7 environmental sensors, watching pollution levels rise as the Extiris stripped the planet. He processes the world through data and measurements — it is easier than processing what happened to the people he measured it for.' },
    { name: 'Wren Gallagher', age: 20, role: 'Civilian', morale: 57, traits: ['Reckless', 'Hopeful'], backstory: 'Survived the Keth-7 evacuation by following Calla Voss through fire and wreckage without looking back. She is young enough to believe that the next planet will be different, and brave enough to make it true.' },
    { name: 'Amina Yusuf', age: 43, role: 'Civilian', morale: 49, traits: ['Determined', 'Empathetic'], backstory: 'Mediated disputes between rival refugee factions on Keth-7 when the occupation turned neighbours against each other. She knows that survival means keeping people talking, even when they would rather fight.' },
    { name: 'Felix Strand', age: 37, role: 'Civilian', morale: 53, traits: ['Resourceful', 'Stubborn'], backstory: 'Ran a salvage operation on Keth-7, recovering usable materials from Extiris bombardment sites. He sees value in what others discard and has turned that instinct into the ESV-7\'s supply chain backbone.' },
    { name: 'Iris Thorne', age: 29, role: 'Civilian', morale: 51, traits: ['Quiet', 'Hopeful'], backstory: 'Kept a written journal through the entire Keth-7 occupation, documenting daily life under Extiris rule. She writes aboard the ESV-7 too — recording names, stories, small moments of kindness — because someone has to remember.' },
];

// ═══════════════════════════════════════════════════════════════════════════
// RELATIONSHIP MANIFEST — ~130 authored relationships
// Each entry creates a bidirectional pair. descAB is from→to, descBA is to→from.
// ═══════════════════════════════════════════════════════════════════════════

export const RELATIONSHIP_MANIFEST: readonly RelationshipDef[] = [

    // ─── CAPTAIN SOREN VAEL — ~37 relationships ────────────────────────
    // Story characters
    { from: 'Commander Soren Vael', to: 'Mira Chen', type: 'Mentor/Protege', level: 72,
        descAB: 'He took Mira under his wing after the exodus', descBA: 'Soren trained her when no one else would' },
    { from: 'Commander Soren Vael', to: 'Lt. Desta Morrow', type: 'Romantic', level: 88,
        descAB: 'Desta is the reason he still believes in tomorrow', descBA: 'They found each other in the dark between stars' },
    { from: 'Commander Soren Vael', to: 'Dr. Yael Chen', type: 'Close Bond', level: 75,
        descAB: 'Yael kept his soldiers alive — he owes her everything', descBA: 'Soren carries the weight so others do not have to' },

    // Soldiers
    { from: 'Commander Soren Vael', to: 'Sgt. Kael Orin', type: 'Close Bond', level: 80,
        descAB: 'Kael has been his right hand since the evacuation', descBA: 'The Commander earned his loyalty in fire and blood' },
    { from: 'Commander Soren Vael', to: 'Cpl. Ren Vasik', type: 'Mentor/Protege', level: 62,
        descAB: 'Vasik is quiet but reliable — exactly what he needs', descBA: 'The Commander sees something in him no one else does' },
    { from: 'Commander Soren Vael', to: 'Pvt. Talia Doss', type: 'Mentor/Protege', level: 55,
        descAB: 'Too young for war but she fights like she has nothing to lose', descBA: 'Soren is the closest thing she has to a father figure' },
    { from: 'Commander Soren Vael', to: 'Sgt. Marcus Webb', type: 'Close Bond', level: 70,
        descAB: 'Webb has been soldiering longer than anyone — steady and unbreakable', descBA: 'Soren is the best commanding officer he has ever served under' },
    { from: 'Commander Soren Vael', to: 'Cpl. Asha Nkomo', type: 'Close Bond', level: 68,
        descAB: 'Nkomo holds the squad together when morale breaks', descBA: 'The Commander trusts her instincts in the field' },

    // Engineers
    { from: 'Commander Soren Vael', to: 'Chief Lena Harsk', type: 'Close Bond', level: 72,
        descAB: 'Harsk keeps this ship flying — that makes her indispensable', descBA: 'Soren listens when she says a system is failing' },
    { from: 'Commander Soren Vael', to: 'Tomás Reyes', type: 'Close Bond', level: 60,
        descAB: 'Reyes never complains — he just fixes things', descBA: 'The Commander always makes time for the engine crew' },
    { from: 'Commander Soren Vael', to: 'Petra Volkov', type: 'Close Bond', level: 58,
        descAB: 'Volkov does not waste words — he respects that', descBA: 'Soren gives her space to work, which is all she asks' },
    { from: 'Commander Soren Vael', to: 'Jin-Soo Park', type: 'Close Bond', level: 62,
        descAB: 'Park brings fresh thinking to old problems', descBA: 'The Commander actually reads his improvement proposals' },
    { from: 'Commander Soren Vael', to: 'Davi Okafor', type: 'Close Bond', level: 56,
        descAB: 'Okafor keeps the life support running — quiet heroism', descBA: 'Soren remembers every name on every shift rotation' },
    { from: 'Commander Soren Vael', to: 'Ruben Ashe', type: 'Close Bond', level: 50,
        descAB: 'Ashe lost people in the exodus — Soren understands that weight', descBA: 'The Commander does not push when the nightmares come' },
    { from: 'Commander Soren Vael', to: 'Freya Lindqvist', type: 'Close Bond', level: 58,
        descAB: 'Lindqvist is the one he sends when it absolutely must work', descBA: 'Soren trusts her with the critical repairs' },
    { from: 'Commander Soren Vael', to: 'Kofi Mensah', type: 'Mentor/Protege', level: 52,
        descAB: 'Mensah is grieving but his hands are still the steadiest in engineering', descBA: 'Soren gave him purpose when everything else was gone' },
    { from: 'Commander Soren Vael', to: 'Yuki Tanaka', type: 'Close Bond', level: 60,
        descAB: 'Tanaka sees systems like poems — useful and strange', descBA: 'The Commander appreciates engineers who think differently' },
    { from: 'Commander Soren Vael', to: 'Ines Bakker', type: 'Close Bond', level: 54,
        descAB: 'Bakker has more courage than sense — reminds him of himself', descBA: 'Soren does not treat her like a kid, which is rare' },

    // Medics
    { from: 'Commander Soren Vael', to: 'Dr. Elias Croft', type: 'Close Bond', level: 58,
        descAB: 'Croft patched him up after the Keth-7 boarding', descBA: 'Soren is one of the few who knows about his nightmares' },
    { from: 'Commander Soren Vael', to: 'Nurse Sable Wren', type: 'Close Bond', level: 55,
        descAB: 'Wren keeps medbay running when the doctors are overwhelmed', descBA: 'The Commander checks on the medical staff personally' },
    { from: 'Commander Soren Vael', to: 'Medic Ravi Anand', type: 'Close Bond', level: 56,
        descAB: 'Anand was a field medic during the evacuation — proven under fire', descBA: 'Soren never forgot that he crawled through wreckage to save wounded' },
    { from: 'Commander Soren Vael', to: 'Dr. Oona Mäkelä', type: 'Close Bond', level: 52,
        descAB: 'Mäkelä is methodical — her reports are always thorough', descBA: 'The Commander actually reads the medical briefs she submits' },

    // Scientists
    { from: 'Commander Soren Vael', to: 'Prof. Idris Konte', type: 'Rival', level: 35,
        descAB: 'Konte questions every tactical decision — useful but infuriating', descBA: 'Soren acts before he thinks, which will get people killed' },
    { from: 'Commander Soren Vael', to: 'Dr. Zara Patel', type: 'Close Bond', level: 60,
        descAB: 'Patel translates science into something soldiers can act on', descBA: 'Soren actually listens, which is more than most commanders' },
    { from: 'Commander Soren Vael', to: 'Ling Zhao', type: 'Close Bond', level: 52,
        descAB: 'Zhao is quiet but her analysis has saved lives', descBA: 'The Commander values data over gut feeling — refreshing' },
    { from: 'Commander Soren Vael', to: 'Nils Eriksen', type: 'Close Bond', level: 48,
        descAB: 'Eriksen lost his family but channels it into his work', descBA: 'Soren understands loss — he does not offer empty comfort' },
    { from: 'Commander Soren Vael', to: 'Dr. Amara Diallo', type: 'Close Bond', level: 56,
        descAB: 'Diallo cares about the people behind the data', descBA: 'Soren treats the science team as essential, not auxiliary' },

    // Civilians
    { from: 'Commander Soren Vael', to: 'Hana Ito', type: 'Mentor/Protege', level: 55,
        descAB: 'Ito reminds him why they fight — she still has hope', descBA: 'The Commander makes her feel like the civilians matter' },
    { from: 'Commander Soren Vael', to: 'Malik Sarr', type: 'Close Bond', level: 50,
        descAB: 'Sarr lost everything but still shows up to help — that takes strength', descBA: 'Soren promised to keep his son safe and he meant it' },
    { from: 'Commander Soren Vael', to: 'Esme Hollis', type: 'Close Bond', level: 54,
        descAB: 'Hollis organises the civilian work crews — keeps things moving', descBA: 'Soren gives her authority to manage the day-to-day' },
    { from: 'Commander Soren Vael', to: 'Zeke Calloway', type: 'Rival', level: 30,
        descAB: 'Calloway undermines authority at every turn', descBA: 'Vael thinks discipline means obedience — it does not' },
    { from: 'Commander Soren Vael', to: 'Bea Morrow', type: 'Close Bond', level: 55,
        descAB: 'Desta\'s mother — he treats her like family', descBA: 'Soren makes her daughter happy, which is enough' },
    { from: 'Commander Soren Vael', to: 'Rosa Herrera', type: 'Close Bond', level: 52,
        descAB: 'Herrera was a community leader before the exodus — still is', descBA: 'Soren consults her before making decisions that affect civilians' },
    { from: 'Commander Soren Vael', to: 'Obi Achebe', type: 'Close Bond', level: 48,
        descAB: 'Achebe teaches the children — preserving what they can', descBA: 'The Commander allocated space for a schoolroom without being asked' },
    { from: 'Commander Soren Vael', to: 'Amina Yusuf', type: 'Close Bond', level: 50,
        descAB: 'Yusuf mediates disputes among the civilians — invaluable', descBA: 'Soren listens to her concerns about rationing' },
    { from: 'Commander Soren Vael', to: 'Felix Strand', type: 'Close Bond', level: 46,
        descAB: 'Strand is stubborn but gets supply logistics done', descBA: 'The Commander respects people who solve problems their own way' },

    // ─── MIRA CHEN — story character ────────────────────────────────────
    { from: 'Mira Chen', to: 'Dr. Yael Chen', type: 'Close Bond', level: 95,
        descAB: 'Yael is her mother — the only family she has left', descBA: 'Mira is her daughter — she would burn worlds to keep her safe' },
    { from: 'Mira Chen', to: 'Lt. Desta Morrow', type: 'Close Bond', level: 70,
        descAB: 'Desta is like a sister — they share the night watch', descBA: 'Mira is fierce and loyal, the little sister she never had' },
    { from: 'Mira Chen', to: 'Pvt. Talia Doss', type: 'Close Bond', level: 72,
        descAB: 'Talia is the only other young soldier — they stick together', descBA: 'Mira does not treat her like a child' },
    { from: 'Mira Chen', to: 'Sgt. Kael Orin', type: 'Close Bond', level: 60,
        descAB: 'Kael watches her back on patrols', descBA: 'Chen fights like someone twice her age' },
    { from: 'Mira Chen', to: 'Cpl. Ren Vasik', type: 'Close Bond', level: 55,
        descAB: 'Vasik does not say much but she trusts his aim', descBA: 'Chen charges in and he covers her — it works' },
    { from: 'Mira Chen', to: 'Hana Ito', type: 'Close Bond', level: 65,
        descAB: 'Hana is the friend she needs outside the barracks', descBA: 'Mira makes her feel safe even when nothing is safe' },
    { from: 'Mira Chen', to: 'Calla Voss', type: 'Close Bond', level: 58,
        descAB: 'Calla is reckless but fun — a rare thing on this ship', descBA: 'Mira is brave in a way that makes you want to be braver' },
    { from: 'Mira Chen', to: 'Wren Gallagher', type: 'Close Bond', level: 52,
        descAB: 'Wren and Calla are always together — she is part of the group now', descBA: 'Mira treats the civilians like equals, not liabilities' },
    { from: 'Mira Chen', to: 'Nurse Sable Wren', type: 'Close Bond', level: 55,
        descAB: 'Sable patched her up twice and never scolded her for being reckless', descBA: 'Mira is young but she bleeds the same as anyone' },
    { from: 'Mira Chen', to: 'Prof. Idris Konte', type: 'Rival', level: 28,
        descAB: 'Konte talks too much and acts too little', descBA: 'Chen is a soldier who thinks violence solves everything' },

    // ─── LT. DESTA MORROW — story character ────────────────────────────
    { from: 'Lt. Desta Morrow', to: 'Bea Morrow', type: 'Close Bond', level: 90,
        descAB: 'Her mother — the anchor that kept her from drifting', descBA: 'Desta carries scars she cannot see, but a mother knows' },
    { from: 'Lt. Desta Morrow', to: 'Sgt. Kael Orin', type: 'Close Bond', level: 65,
        descAB: 'Kael is steady — she needs that', descBA: 'Desta leads with heart, which the squad needs' },
    { from: 'Lt. Desta Morrow', to: 'Sgt. Marcus Webb', type: 'Close Bond', level: 60,
        descAB: 'Webb has seen more than any of them — she respects his endurance', descBA: 'Desta reminds him why they protect people' },
    { from: 'Lt. Desta Morrow', to: 'Dr. Elias Croft', type: 'Close Bond', level: 62,
        descAB: 'Croft understands what the fighting does to people', descBA: 'Desta checks on the medics — most officers forget to' },
    { from: 'Lt. Desta Morrow', to: 'Cpl. Asha Nkomo', type: 'Close Bond', level: 68,
        descAB: 'Asha holds the squad together when Desta cannot', descBA: 'Desta is the officer who remembers you are human' },
    { from: 'Lt. Desta Morrow', to: 'Dr. Yael Chen', type: 'Close Bond', level: 65,
        descAB: 'Yael is the mother figure the whole ship needs', descBA: 'Desta protects Mira — Yael will never forget that' },
    { from: 'Lt. Desta Morrow', to: 'Medic Ravi Anand', type: 'Close Bond', level: 58,
        descAB: 'Anand pulled wounded from a collapsing corridor — she was there', descBA: 'Desta covered him while he worked — he owes her his life' },
    { from: 'Lt. Desta Morrow', to: 'Noor Farah', type: 'Mentor/Protege', level: 60,
        descAB: 'Noor wants to help but does not know how — Desta shows her', descBA: 'Desta makes her believe she can be useful' },

    // ─── DR. YAEL CHEN — story character ────────────────────────────────
    { from: 'Dr. Yael Chen', to: 'Dr. Elias Croft', type: 'Close Bond', level: 72,
        descAB: 'Elias runs medbay with her — they disagree on methods but trust each other', descBA: 'Yael is the heart of the medical team — he provides the steady hands' },
    { from: 'Dr. Yael Chen', to: 'Nurse Sable Wren', type: 'Mentor/Protege', level: 70,
        descAB: 'Sable will be a fine doctor someday', descBA: 'Yael teaches with patience she did not know she had' },
    { from: 'Dr. Yael Chen', to: 'Medic Ravi Anand', type: 'Mentor/Protege', level: 65,
        descAB: 'Ravi has battlefield instincts — she is sharpening the rest', descBA: 'Yael turned him from a field medic into a real physician' },
    { from: 'Dr. Yael Chen', to: 'Dr. Oona Mäkelä', type: 'Close Bond', level: 62,
        descAB: 'Oona is meticulous — a perfect complement to her own instinct-driven style', descBA: 'Yael leads with empathy, Oona with data — they cover each other' },
    { from: 'Dr. Yael Chen', to: 'Sgt. Marcus Webb', type: 'Close Bond', level: 55,
        descAB: 'Webb has old injuries she monitors — he always downplays the pain', descBA: 'Doc Chen never lies about how bad it is — he appreciates that' },
    { from: 'Dr. Yael Chen', to: 'Old Kaede Sato', type: 'Close Bond', level: 60,
        descAB: 'Kaede is aging and needs quiet care — Yael provides it without fuss', descBA: 'The doctor visits even when nothing is wrong — that means everything' },
    { from: 'Dr. Yael Chen', to: 'Obi Achebe', type: 'Close Bond', level: 55,
        descAB: 'Achebe brings the children to medbay for checkups — she appreciates his dedication', descBA: 'Yael is gentle with the children — they trust her' },
    { from: 'Dr. Yael Chen', to: 'Priya Bhat', type: 'Mentor/Protege', level: 55,
        descAB: 'Priya shows aptitude — Yael is teaching her basic triage', descBA: 'Yael sees potential in her that she did not see in herself' },

    // ─── SOLDIERS (remaining) ───────────────────────────────────────────
    { from: 'Sgt. Kael Orin', to: 'Cpl. Ren Vasik', type: 'Close Bond', level: 68,
        descAB: 'Vasik follows orders without question — the ideal subordinate', descBA: 'Orin is tough but fair, the best sergeant he could ask for' },
    { from: 'Sgt. Kael Orin', to: 'Sgt. Marcus Webb', type: 'Close Bond', level: 65,
        descAB: 'Webb and he are the old guard — they have seen too much together', descBA: 'Orin is the only one who does not flinch at the stories' },
    { from: 'Sgt. Kael Orin', to: 'Pvt. Talia Doss', type: 'Mentor/Protege', level: 58,
        descAB: 'Doss is raw talent — someone has to keep her alive long enough to learn', descBA: 'Orin yells at her because he cares, which is annoying but true' },
    { from: 'Cpl. Ren Vasik', to: 'Cpl. Asha Nkomo', type: 'Close Bond', level: 60,
        descAB: 'Nkomo talks enough for both of them — it works somehow', descBA: 'Vasik is the calm presence when everything goes loud' },
    { from: 'Pvt. Talia Doss', to: 'Cpl. Asha Nkomo', type: 'Close Bond', level: 62,
        descAB: 'Asha is the big sister of the squad — always looking out', descBA: 'Talia is young but she does not freeze under fire' },
    { from: 'Sgt. Marcus Webb', to: 'Dr. Elias Croft', type: 'Close Bond', level: 55,
        descAB: 'Croft stitched him back together more times than he can count', descBA: 'Webb is the patient who always says he is fine when he is not' },
    { from: 'Sgt. Marcus Webb', to: 'Ruben Ashe', type: 'Close Bond', level: 50,
        descAB: 'Ashe was on the same evac shuttle — they do not talk about it', descBA: 'Webb understands silence — they share it' },
    { from: 'Cpl. Asha Nkomo', to: 'Nurse Sable Wren', type: 'Close Bond', level: 60,
        descAB: 'Wren patches the squad up and never complains', descBA: 'Nkomo always brings the wounded in gently, not like some soldiers' },

    // ─── ENGINEERS ──────────────────────────────────────────────────────
    { from: 'Chief Lena Harsk', to: 'Tomás Reyes', type: 'Close Bond', level: 70,
        descAB: 'Reyes is her best engineer — dependable in a crisis', descBA: 'Chief Harsk is demanding but she fights for her people' },
    { from: 'Chief Lena Harsk', to: 'Petra Volkov', type: 'Close Bond', level: 62,
        descAB: 'Volkov works alone but her results are impeccable', descBA: 'The Chief respects competence — nothing more needed' },
    { from: 'Chief Lena Harsk', to: 'Ruben Ashe', type: 'Close Bond', level: 55,
        descAB: 'Ashe has dark days but he knows the old systems better than anyone', descBA: 'Harsk covers for him when the nightmares are bad' },
    { from: 'Chief Lena Harsk', to: 'Kofi Mensah', type: 'Close Bond', level: 58,
        descAB: 'Mensah is grieving but his hands never shake', descBA: 'The Chief gave him extra shifts to keep him busy — it helped' },
    { from: 'Chief Lena Harsk', to: 'Prof. Idris Konte', type: 'Rival', level: 32,
        descAB: 'Konte wants to redesign systems that are keeping people alive — reckless', descBA: 'Harsk refuses to innovate — she will ride this ship into the ground' },
    { from: 'Tomás Reyes', to: 'Jin-Soo Park', type: 'Close Bond', level: 65,
        descAB: 'Park thinks in systems — Reyes builds them, they are a good team', descBA: 'Tomás makes the impossible seem routine' },
    { from: 'Tomás Reyes', to: 'Ines Bakker', type: 'Mentor/Protege', level: 60,
        descAB: 'Bakker is brilliant but reckless — he channels her energy', descBA: 'Tomás does not micromanage, which is why she listens to him' },
    { from: 'Petra Volkov', to: 'Freya Lindqvist', type: 'Close Bond', level: 58,
        descAB: 'Lindqvist is the only engineer who matches her work ethic', descBA: 'Petra says more with a nod than most do with speeches' },
    { from: 'Jin-Soo Park', to: 'Yuki Tanaka', type: 'Close Bond', level: 65,
        descAB: 'Tanaka and he speak the same language — patterns and data', descBA: 'Jin-Soo makes her analysis actionable' },
    { from: 'Jin-Soo Park', to: 'Dr. Zara Patel', type: 'Close Bond', level: 55,
        descAB: 'Patel bridges the gap between science and engineering', descBA: 'Park implements what she theorises — rare cooperation' },
    { from: 'Davi Okafor', to: 'Sarai Okafor', type: 'Close Bond', level: 85,
        descAB: 'Sarai is his sister — they escaped together', descBA: 'Davi promised their parents he would protect her' },
    { from: 'Ines Bakker', to: 'Wren Gallagher', type: 'Romantic', level: 78,
        descAB: 'Wren makes her laugh — a miracle on this ship', descBA: 'Ines is brilliant and a little terrifying and she loves both' },
    { from: 'Freya Lindqvist', to: 'Nils Eriksen', type: 'Close Bond', level: 50,
        descAB: 'Eriksen helps calibrate instruments — quiet shared work', descBA: 'Lindqvist does not ask questions about his family — he appreciates that' },
    { from: 'Kofi Mensah', to: 'Obi Achebe', type: 'Close Bond', level: 60,
        descAB: 'Achebe knew his wife — they share stories about her', descBA: 'Kofi smiles sometimes when they talk about the old days' },
    { from: 'Yuki Tanaka', to: 'Ling Zhao', type: 'Close Bond', level: 62,
        descAB: 'Zhao and she share a love of elegant solutions', descBA: 'Tanaka approaches engineering with a scientist\'s eye — refreshing' },

    // ─── MEDICS ─────────────────────────────────────────────────────────
    { from: 'Dr. Elias Croft', to: 'Nurse Sable Wren', type: 'Close Bond', level: 68,
        descAB: 'Wren keeps medbay organised when he is overwhelmed', descBA: 'Croft trusts her to triage — not everyone gets that trust' },
    { from: 'Dr. Elias Croft', to: 'Dr. Oona Mäkelä', type: 'Close Bond', level: 58,
        descAB: 'Mäkelä catches what he misses — they complement each other', descBA: 'Croft works on instinct, she works on evidence — together they save lives' },
    { from: 'Nurse Sable Wren', to: 'Medic Ravi Anand', type: 'Close Bond', level: 62,
        descAB: 'Ravi works the night shifts with her — they keep each other awake', descBA: 'Sable is the reason medbay does not fall apart at 3am' },
    { from: 'Medic Ravi Anand', to: 'Pvt. Talia Doss', type: 'Close Bond', level: 52,
        descAB: 'Doss gets hurt too often but always jokes about it', descBA: 'Anand never lectures her, just patches her up and smiles' },
    { from: 'Dr. Oona Mäkelä', to: 'Ling Zhao', type: 'Close Bond', level: 55,
        descAB: 'Zhao consults on environmental health data — meticulous like her', descBA: 'Mäkelä is a scientist with a stethoscope — they understand each other' },

    // ─── SCIENTISTS ─────────────────────────────────────────────────────
    { from: 'Prof. Idris Konte', to: 'Dr. Zara Patel', type: 'Mentor/Protege', level: 65,
        descAB: 'Patel is his most promising colleague — she will lead the team someday', descBA: 'Konte is stubborn but his mind is extraordinary' },
    { from: 'Prof. Idris Konte', to: 'Nils Eriksen', type: 'Close Bond', level: 55,
        descAB: 'Eriksen has lost hope but not his skill — Konte needs both', descBA: 'Konte gives him problems hard enough to forget the grief' },
    { from: 'Prof. Idris Konte', to: 'Dr. Amara Diallo', type: 'Close Bond', level: 60,
        descAB: 'Diallo balances his analytical coldness with empathy', descBA: 'Konte pushes boundaries — someone has to make sure people matter' },
    { from: 'Dr. Zara Patel', to: 'Ling Zhao', type: 'Close Bond', level: 62,
        descAB: 'Zhao and she co-author most of the survey reports', descBA: 'Patel is the optimist the lab needs' },
    { from: 'Dr. Zara Patel', to: 'Dr. Amara Diallo', type: 'Close Bond', level: 58,
        descAB: 'Amara and she argue about ethics in a way that makes them both better', descBA: 'Zara is driven — Amara makes sure she does not lose herself in it' },
    { from: 'Nils Eriksen', to: 'Dex Roan', type: 'Close Bond', level: 45,
        descAB: 'Roan is quiet company — they play chess without speaking', descBA: 'Eriksen does not ask about the past, which is a kindness' },
    { from: 'Dr. Amara Diallo', to: 'Noor Farah', type: 'Mentor/Protege', level: 55,
        descAB: 'Noor has a talent for observation — she is training her', descBA: 'Amara sees talent where others see just a civilian' },

    // ─── CIVILIAN PAIRS AND CLUSTERS ────────────────────────────────────
    { from: 'Malik Sarr', to: 'Tomas Sarr Jr.', type: 'Close Bond', level: 85,
        descAB: 'His son — the only reason he keeps going', descBA: 'Dad is broken but he still tries, every single day' },
    { from: 'Malik Sarr', to: 'Rosa Herrera', type: 'Close Bond', level: 55,
        descAB: 'Herrera organises food distribution — she made sure his boy ate first', descBA: 'Malik lost his wife but he never lost his dignity' },
    { from: 'Tomas Sarr Jr.', to: 'Calla Voss', type: 'Romantic', level: 76,
        descAB: 'Calla makes the ship feel less like a prison', descBA: 'Tomas is quiet until he is not, and she loves both versions' },
    { from: 'Hana Ito', to: 'Noor Farah', type: 'Close Bond', level: 65,
        descAB: 'Noor is kind in a world that forgot how to be', descBA: 'Hana sees the best in everyone — it is contagious' },
    { from: 'Hana Ito', to: 'Priya Bhat', type: 'Close Bond', level: 58,
        descAB: 'Priya and she share a bunk and swap stories late at night', descBA: 'Hana never judges — she just listens' },
    { from: 'Esme Hollis', to: 'Felix Strand', type: 'Romantic', level: 80,
        descAB: 'Felix is stubborn but he makes her feel like home', descBA: 'Esme organises the chaos around him — he needs that' },
    { from: 'Esme Hollis', to: 'Amina Yusuf', type: 'Close Bond', level: 58,
        descAB: 'Amina mediates when tempers flare — essential on a crowded ship', descBA: 'Esme gets things done — Amina makes sure people feel heard' },
    { from: 'Old Kaede Sato', to: 'Iris Thorne', type: 'Mentor/Protege', level: 55,
        descAB: 'Iris listens to the old stories — she is preserving them', descBA: 'Kaede remembers the world before — every word is precious' },
    { from: 'Zeke Calloway', to: 'Joss Delacroix', type: 'Close Bond', level: 52,
        descAB: 'Joss is the only one who does not judge his anger', descBA: 'Zeke is loud but honest — refreshing on a ship of polite liars' },
    { from: 'Zeke Calloway', to: 'Lev Petrov', type: 'Rival', level: 25,
        descAB: 'Petrov thinks he knows better than everyone — smug bastard', descBA: 'Calloway is a child throwing tantrums in a crisis' },
    { from: 'Noor Farah', to: 'Priya Bhat', type: 'Close Bond', level: 60,
        descAB: 'Priya shares her optimism — they need more of that', descBA: 'Noor sees people clearly and still believes in them' },
    { from: 'Fen Xu', to: 'Silas Kade', type: 'Close Bond', level: 55,
        descAB: 'Kade is quiet like him — they work the same data shifts', descBA: 'Fen does not fill silence with noise — a rare quality' },
    { from: 'Joss Delacroix', to: 'Dex Roan', type: 'Close Bond', level: 48,
        descAB: 'Roan knows what it is like to not sleep — they sit up together', descBA: 'Delacroix does not pretend the nightmares are not real' },
    { from: 'Sarai Okafor', to: 'Rosa Herrera', type: 'Close Bond', level: 55,
        descAB: 'Rosa is the community anchor — Sarai helps with food distribution', descBA: 'Sarai is young but she shows up every shift without fail' },
    { from: 'Lev Petrov', to: 'Felix Strand', type: 'Rival', level: 30,
        descAB: 'Strand wastes resources on sentiment — they need efficiency', descBA: 'Petrov would sacrifice comfort for numbers — people are not numbers' },
    { from: 'Calla Voss', to: 'Wren Gallagher', type: 'Close Bond', level: 72,
        descAB: 'Wren is her best friend — they survived the exodus holding hands', descBA: 'Calla is the brave one — Wren follows her anywhere' },
    { from: 'Obi Achebe', to: 'Amina Yusuf', type: 'Close Bond', level: 58,
        descAB: 'Amina helps with the older children — they work well together', descBA: 'Obi teaches and she supports — the kids need both' },
    { from: 'Rosa Herrera', to: 'Amina Yusuf', type: 'Close Bond', level: 55,
        descAB: 'Amina and she handle the community meetings together', descBA: 'Rosa leads, Amina smooths — good partnership' },
    { from: 'Silas Kade', to: 'Iris Thorne', type: 'Romantic', level: 75,
        descAB: 'Iris sees beauty in everything — even him, somehow', descBA: 'Silas is quiet but his eyes say everything' },

    // ─── CROSS-ROLE BONDS ───────────────────────────────────────────────
    { from: 'Tomás Reyes', to: 'Esme Hollis', type: 'Close Bond', level: 55,
        descAB: 'Hollis coordinates civilian work crews with engineering — smooth operator', descBA: 'Tomás never talks down to civilians, which is why they help him' },
    { from: 'Davi Okafor', to: 'Medic Ravi Anand', type: 'Close Bond', level: 52,
        descAB: 'Anand kept his sister alive during a reactor leak', descBA: 'Okafor brings engineering problems to him like they are medical emergencies — endearing' },
    { from: 'Ines Bakker', to: 'Dr. Zara Patel', type: 'Close Bond', level: 55,
        descAB: 'Patel makes science interesting — not everyone manages that', descBA: 'Bakker builds what she designs — rare synergy' },
    { from: 'Ruben Ashe', to: 'Joss Delacroix', type: 'Estranged', level: 15,
        descAB: 'Delacroix was on the same evac ship — they saw things together they cannot discuss', descBA: 'Ashe will not look at him — the memories are in his face' },
    { from: 'Freya Lindqvist', to: 'Dr. Amara Diallo', type: 'Close Bond', level: 52,
        descAB: 'Diallo understands how engineering impacts the environment', descBA: 'Lindqvist builds with care — not all engineers do' },
    { from: 'Dr. Elias Croft', to: 'Dex Roan', type: 'Mentor/Protege', level: 50,
        descAB: 'Roan has insomnia — Croft monitors him without making it clinical', descBA: 'Croft does not judge — he just helps' },
    { from: 'Nurse Sable Wren', to: 'Hana Ito', type: 'Close Bond', level: 55,
        descAB: 'Hana volunteers in medbay — her warmth helps the patients', descBA: 'Sable teaches her first aid with genuine patience' },
    { from: 'Sgt. Kael Orin', to: 'Lev Petrov', type: 'Estranged', level: 20,
        descAB: 'Petrov filed a complaint about patrol routes — wasted everyone\'s time', descBA: 'Orin threatened him for asking questions — that is not discipline' },
    { from: 'Cpl. Asha Nkomo', to: 'Sarai Okafor', type: 'Close Bond', level: 55,
        descAB: 'Sarai is kind and steady — she reminds her of home', descBA: 'Asha protects people like it is breathing — inspiring' },
    { from: 'Pvt. Talia Doss', to: 'Tomas Sarr Jr.', type: 'Close Bond', level: 50,
        descAB: 'Sarr is the same age — they grew up in the same corridor', descBA: 'Talia chose to fight so others would not have to — he respects that' },
];
