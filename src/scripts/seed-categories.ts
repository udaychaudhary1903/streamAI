import { db } from "../db";
import { categories } from "../db/schema";

const categoryNames = [
    "Film & Animation",
    "Autos & Vehicles",
    "Music",
    "Pets & Animals",
    "Sports",
    "Travel & Events",
    "Gaming",
    "People & Blogs",
    "Comedy",
    "Entertainment",
    "News & Politics",
    "Howto & Style",
    "Education",
    "Science & Technology",
    "Nonprofits & Activism"
];

async function main() {
    console.log("Seeding categories...");
     
    try {
        const values = categoryNames.map((name) => ({
            name,
            description: `Videos related to ${name.toLowerCase()}`,
        }));
        await db.delete(categories); // remove old data
        await db.insert(categories).values(values);

        console.log("Categories seeded successfully!");
    } catch (error) {
        console.error("Error seeding categories:", error);
        process.exit(1);
    }
}

main();