import { buildRouteMap } from "@stricli/core";
import { skillsCommand } from "./skills/command.js";
import { tagsCommand } from "./tags/command.js";

export const generateRoutes = buildRouteMap({
	routes: {
		tags: tagsCommand,
		skills: skillsCommand,
	},
	docs: {
		brief: "Generate tags or skills",
	},
});
