import { buildRouteMap } from "@stricli/core";
import { skillsCommand } from "./skills.js";
import { tagsCommand } from "./tags.js";

export const generateRoutes = buildRouteMap({
	routes: {
		tags: tagsCommand,
		skills: skillsCommand,
	},
	docs: {
		brief: "Generate tags or skills",
	},
});
