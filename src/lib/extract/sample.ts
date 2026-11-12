import type { Extraction } from "./schema";

// What a real read of a long, messy combo slip tends to look like: cut-off names, short forms,
// a leg with no league, a prop with no team. Lets you try the confirm screen without an API key.
export const SAMPLE_EXTRACTION: Extraction = {
  source: "Sample slip",
  legs: [
    { pick: "Prairie View A&M", opponent: "Southern ...", league: "NCAA Football", bet_type: "moneyline", line: "", price: "41%", needs_review: true, review_reason: "Opponent cut off on the slip: \"Prairie View A&M vs Southern ...\"." },
    { pick: "Miss. Valley St.", opponent: "Alcorn St.", league: "College Football", bet_type: "spread", line: "+10.5", price: "-110", needs_review: false, review_reason: "" },
    { pick: "Hawai'i", opponent: "San Diego St.", league: "NCAA Football", bet_type: "moneyline", line: "", price: "55%", needs_review: false, review_reason: "" },
    { pick: "Okla. St.", opponent: "Texas Tech", league: "NCAA Football", bet_type: "spread", line: "+6.5", price: "-110", needs_review: false, review_reason: "" },
    { pick: "Chiefs", opponent: "Bills", league: "NFL", bet_type: "spread", line: "-2.5", price: "-115", needs_review: false, review_reason: "" },
    { pick: "Over", opponent: "BUF/KC", league: "NFL", bet_type: "total", line: "o47.5", price: "-110", needs_review: false, review_reason: "" },
    { pick: "NDSU", opponent: "S. Dakota St.", league: "FCS", bet_type: "moneyline", line: "", price: "52%", needs_review: false, review_reason: "" },
    { pick: "Celtics", opponent: "Knicks", league: "NBA", bet_type: "spread", line: "-4.5", price: "-110", needs_review: false, review_reason: "" },
    { pick: "Prairie View", opponent: null, league: "", bet_type: "spread", line: "-3.5", price: "-110", needs_review: true, review_reason: "League and opponent aren't shown for this leg." },
    { pick: "Montana St...", opponent: null, league: "NCAA Football", bet_type: "moneyline", line: "", price: "61%", needs_review: true, review_reason: "Team name is cut off on the slip." },
    { pick: "Jalen Hurts", opponent: null, league: "NFL", bet_type: "prop", line: "40+ rush yds", price: "+120", needs_review: false, review_reason: "" },
    { pick: "Duke", opponent: "Kansas", league: "College Basketball", bet_type: "moneyline", line: "", price: "58%", needs_review: false, review_reason: "" },
    { pick: "Under", opponent: "UCLA vs Gonzaga", league: "College Basketball", bet_type: "total", line: "u152.5", price: "-110", needs_review: false, review_reason: "" },
  ],
};
