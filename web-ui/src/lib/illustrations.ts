// Locally-bundled kachō-e style illustrations pulled from Twarner491/AvianVisitors
// (see public/illustrations/ATTRIBUTION.md) for the species detected in this
// project's own birds.db. Preferred over the Wikipedia thumbnail when present.
const AVAILABLE_SLUGS = new Set([
	"agelaius-phoeniceus",
	"archilochus-colubris",
	"baeolophus-bicolor",
	"bombycilla-cedrorum",
	"bubo-virginianus",
	"cardinalis-cardinalis",
	"corvus-brachyrhynchos",
	"cyanocitta-cristata",
	"dryobates-pubescens",
	"gavia-immer",
	"haemorhous-mexicanus",
	"junco-hyemalis",
	"megascops-asio",
	"melospiza-melodia",
	"passer-domesticus",
	"poecile-atricapillus",
	"quiscalus-quiscula",
	"sitta-canadensis",
	"sitta-carolinensis",
	"spinus-tristis",
	"strix-varia",
	"sturnus-vulgaris",
	"thryothorus-ludovicianus",
	"turdus-migratorius",
	"zenaida-macroura",
	"zonotrichia-albicollis",
]);

function slugify(sciName: string): string {
	return sciName.trim().toLowerCase().replaceAll(/\s+/g, "-");
}

export function illustrationUrlFor(sciName: string): string | null {
	const slug = slugify(sciName);
	return AVAILABLE_SLUGS.has(slug) ? `/illustrations/${slug}.png` : null;
}
