// Starting points for the brief. Brands are fictional and labelled sample.
export interface Preset {
  id: string;
  label: string;
  brandName: string;
  loves: string[];
  audienceText: string;
  brandVoice: string;
}

export const presets: Preset[] = [
  {
    id: "comedy",
    label: "Comedy tour",
    brandName: "Porchlight Comedy Tour (sample brand)",
    loves: ["stand-up comedy specials", "90s sitcoms", "southern hip-hop"],
    audienceText: "people who quote 90s sitcoms and go to stand-up shows",
    brandVoice: "warm, a little cheeky, never mean",
  },
  {
    id: "coffee",
    label: "Coffee roaster",
    brandName: "Cast Iron Coffee (sample brand)",
    loves: ["indie folk", "vinyl records", "natural wine"],
    audienceText: "slow-morning people who browse record shops on weekends",
    brandVoice: "quiet, dry, confident",
  },
  {
    id: "sneakers",
    label: "Running shoe",
    brandName: "Northside Runners (sample brand)",
    loves: ["trail running", "podcasts about endurance", "farmers markets"],
    audienceText: "weekend long-run crowd who plan routes around a good brunch",
    brandVoice: "upbeat, plain-spoken",
  },
];

/** Shown so a judge can watch the guard refuse identity targeting and offer a taste-based version. */
export const guardProbe = "reach Black men 25 to 40";
