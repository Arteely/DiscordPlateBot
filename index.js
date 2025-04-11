// index.js
require("dotenv").config();
const { Client, IntentsBitField, EmbedBuilder } = require("discord.js");
const mongoose = require("mongoose");
const port = process.env.PORT || 4000;
const { registerCommands } = require("./commands");
const {
  calculatePlateScore,
  parseTurkishPlate,
  getPlateTypeDisplay,
} = require("./scoring");

// Set up Discord client with appropriate intents
const client = new Client({
  intents: [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.MessageContent,
    IntentsBitField.Flags.GuildMembers,
  ],
});

// Connect to MongoDB database
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Define database schema for plates
const PlateSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  username: { type: String, required: true },
  plateText: { type: String, required: true, uppercase: true },
  provinceCode: { type: String, required: true },
  letters: { type: String, required: true },
  digits: { type: String, required: true },
  plateType: { type: String, required: true },
  provinceScore: { type: Number, default: 0 },
  letterScore: { type: Number, default: 0 },
  digitScore: { type: Number, default: 0 },
  specialScore: { type: Number, default: 0 },
  totalScore: { type: Number, default: 0 },
  dateSpotted: { type: Date, default: Date.now },
});

// Create a unique compound index to prevent duplicate entries
PlateSchema.index({ userId: 1, plateText: 1 }, { unique: true });

const Plate = mongoose.model("Plate", PlateSchema);

// Bot slash command handling
client.on("interactionCreate", async (interaction) => {
  // Only process slash commands
  if (!interaction.isCommand()) return;

  const { commandName, options } = interaction;

  // Command: Add a new plate
  if (commandName === "addplate") {
    const plateText = options
      .getString("plate")
      .toUpperCase()
      .replace(/[\s-]/g, "");

    // Validate the plate has the correct format for a Turkish plate
    if (!plateText.match(/^\d{1,2}[A-Z]{1,3}\d{1,4}$/)) {
      return interaction.reply({
        content:
          "Invalid Turkish license plate format. Valid examples: 34AB123, 06ABC01, 81A1234",
        ephemeral: true,
      });
    }

    // Calculate score using our Turkish system
    const result = calculatePlateScore(plateText);
    const { totalScore, plateType, breakdown, parsed } = result;

    try {
      // Check if plate already exists in user's collection
      const existingPlate = await Plate.findOne({
        userId: interaction.user.id,
        plateText: plateText,
      });

      if (existingPlate) {
        return interaction.reply({
          content: `You already have this plate (${plateText}) in your collection!`,
          ephemeral: true,
        });
      }

      // Create new plate entry with parsed components
      const newPlate = new Plate({
        userId: interaction.user.id,
        username: interaction.user.username,
        plateText: plateText,
        provinceCode: parsed.provinceCode,
        letters: parsed.letters,
        digits: parsed.digits,
        plateType: plateType,
        provinceScore: breakdown.province,
        letterScore: breakdown.letters,
        digitScore: breakdown.digits,
        specialScore: breakdown.special,
        totalScore: totalScore,
      });

      await newPlate.save();

      // Create a rich embed for better display
      const embed = new EmbedBuilder()
        .setTitle(`🚗 New Plate Added: ${plateText}`)
        .setDescription(
          `You spotted a plate from province ${parsed.provinceCode}!`
        )
        .addFields(
          {
            name: "Total Score",
            value: `${totalScore} points ${getScoreEmoji(totalScore)}`,
            inline: true,
          },
          {
            name: "Plate Type",
            value: getPlateTypeDisplay(plateType),
            inline: true,
          },
          {
            name: "Score Breakdown",
            value:
              `🏙️ Province: ${breakdown.province}\n` +
              `🔤 Letters: ${breakdown.letters}\n` +
              `🔢 Digit Mult: ${breakdown.digits}\n` +
              `🔢 Digit Sum: ${breakdown.digitsum}\n` +
              `✨ Type Mult: ${breakdown.special}`,
          },
          {
            name: "Score Calculation",
            value:
              `((${breakdown.letters} + ${breakdown.digitsum}) × ${breakdown.digits}) × ${breakdown.province} × ${breakdown.special}`,
          }
        )
        .setColor(getScoreColor(totalScore))
        .setFooter({ text: "Happy collecting!" });

      interaction.reply({ embeds: [embed] });
    } catch (err) {
      console.error("Error saving plate:", err);
      interaction.reply({
        content: "There was an error adding your plate. Please try again.",
        ephemeral: true,
      });
    }
  }

  // Command: View your collection
  else if (commandName === "mycollection") {
    try {
      const plates = await Plate.find({ userId: interaction.user.id });

      if (plates.length === 0) {
        return interaction.reply({
          content: "You haven't collected any plates yet!",
          ephemeral: true,
        });
      }

      // Count total score
      const totalScore = plates.reduce(
        (sum, plate) => sum + plate.totalScore,
        0
      );
      const avgScore = Math.round((totalScore / plates.length) * 10) / 10;

      // Count by province
      const provinceCount = {};
      plates.forEach((plate) => {
        provinceCount[plate.provinceCode] =
          (provinceCount[plate.provinceCode] || 0) + 1;
      });

      // Format province counts
      const provincesCollected = Object.keys(provinceCount).length;
      const topProvinces = Object.entries(provinceCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([province, count]) => `${province}: ${count}`);

      // Group by plate type
      const typeCount = {};
      plates.forEach((plate) => {
        typeCount[plate.plateType] = (typeCount[plate.plateType] || 0) + 1;
      });

      // Format plate types
      const plateTypes = Object.entries(typeCount)
        .sort((a, b) => b[1] - a[1])
        .map(([type, count]) => `${getPlateTypeDisplay(type)}: ${count}`);

      // Recent additions
      const recentPlates = [...plates]
        .sort((a, b) => b.dateSpotted - a.dateSpotted)
        .slice(0, 5)
        .map(
          (p) =>
            `${p.plateText} (${p.totalScore} pts ${getScoreEmoji(
              p.totalScore
            )})`
        );

      // Highest scoring plates
      const topScoringPlates = [...plates]
        .sort((a, b) => b.totalScore - a.totalScore)
        .slice(0, 3)
        .map(
          (p) =>
            `${p.plateText} (${p.totalScore} pts ${getScoreEmoji(
              p.totalScore
            )})`
        );

      const embed = new EmbedBuilder()
        .setTitle(`${interaction.user.username}'s License Plate Collection`)
        .setDescription(
          `Total Plates: ${plates.length}\nTotal Score: ${totalScore}\nAverage Score: ${avgScore}`
        )
        .addFields(
          {
            name: "Recent Additions",
            value: recentPlates.join("\n") || "None",
          },
          {
            name: "Highest Scoring Plates",
            value: topScoringPlates.join("\n") || "None",
          },
          {
            name: `Provinces (${provincesCollected}/81)`,
            value: topProvinces.join("\n") || "None",
          },
          { name: "Plate Types", value: plateTypes.join("\n") || "None" }
        )
        .setColor("#0099ff")
        .setThumbnail(interaction.user.displayAvatarURL());

      interaction.reply({ embeds: [embed] });
    } catch (err) {
      console.error("Error retrieving collection:", err);
      interaction.reply({
        content:
          "There was an error retrieving your collection. Please try again.",
        ephemeral: true,
      });
    }
  }

  // Command: View leaderboard
  else if (commandName === "leaderboard") {
    try {
      // Aggregate to count plates and sum scores per user
      const leaderboard = await Plate.aggregate([
        {
          $group: {
            _id: { userId: "$userId", username: "$username" },
            plateCount: { $sum: 1 },
            totalScore: { $sum: "$totalScore" },
            uniqueProvinces: { $addToSet: "$provinceCode" },
            uniqueTypes: { $addToSet: "$plateType" },
            highestScore: { $max: "$totalScore" },
          },
        },
        { $sort: { totalScore: -1 } },
        { $limit: 10 },
      ]);

      if (leaderboard.length === 0) {
        return interaction.reply({
          content: "No plates have been collected yet!",
          ephemeral: true,
        });
      }

      const embed = new EmbedBuilder()
        .setTitle("🏆 License Plate Collection Leaderboard")
        .setDescription("Top collectors ranked by score")
        .addFields(
          {
            name: "Rank",
            value: leaderboard.map((entry, i) => `#${i + 1}`).join("\n"),
            inline: true,
          },
          {
            name: "User",
            value: leaderboard.map((entry) => entry._id.username).join("\n"),
            inline: true,
          },
          {
            name: "Stats",
            value: leaderboard
              .map(
                (entry) =>
                  `${entry.totalScore} pts | ${entry.plateCount} plates | ${entry.uniqueProvinces.length}/81 provinces`
              )
              .join("\n"),
            inline: true,
          }
        )
        .setColor("#FFD700")
        .setFooter({ text: "Updated as of " + new Date().toLocaleString() });

      interaction.reply({ embeds: [embed] });
    } catch (err) {
      console.error("Error retrieving leaderboard:", err);
      interaction.reply({
        content:
          "There was an error retrieving the leaderboard. Please try again.",
        ephemeral: true,
      });
    }
  }

  // Command: View info about a specific plate
  else if (commandName === "plateinfo") {
    const plateText = options
      .getString("plate")
      .toUpperCase()
      .replace(/[\s-]/g, "");

    try {
      // Find this plate in the database
      const plates = await Plate.find({
        plateText: plateText,
      }).sort({ dateSpotted: 1 });

      if (plates.length === 0) {
        const result = calculatePlateScore(plateText);

        return interaction.reply(
          `No one has collected the ${plateText} plate yet! You could be the first with \`/addplate\`.\nEstimated score: ${
            result.totalScore
          } points (${getPlateTypeDisplay(result.plateType)})`
        );
      }

      // Get the first person who spotted this plate
      const firstSpotter = plates[0];

      // Count how many people have this plate
      const spotCount = plates.length;

      // Parse the plate
      const { provinceCode, letters, digits } = parseTurkishPlate(plateText);

      const embed = new EmbedBuilder()
        .setTitle(`License Plate Info: ${plateText}`)
        .setDescription(
          `This plate has been spotted by ${spotCount} collector${
            spotCount !== 1 ? "s" : ""
          }.`
        )
        .addFields(
          { name: "Province Code", value: provinceCode, inline: true },
          {
            name: "Plate Type",
            value: getPlateTypeDisplay(firstSpotter.plateType),
            inline: true,
          },
          {
            name: "Score",
            value: `${firstSpotter.totalScore} points ${getScoreEmoji(
              firstSpotter.totalScore
            )}`,
            inline: true,
          },
          {
            name: "First Spotted By",
            value: firstSpotter.username,
            inline: true,
          },
          {
            name: "Date First Spotted",
            value: firstSpotter.dateSpotted.toLocaleDateString(),
            inline: true,
          }
        )
        .setColor(getScoreColor(firstSpotter.totalScore));

      interaction.reply({ embeds: [embed] });
    } catch (err) {
      console.error("Error retrieving plate info:", err);
      interaction.reply({
        content:
          "There was an error retrieving information for this plate. Please try again.",
        ephemeral: true,
      });
    }
  }

  // Command: Get province statistics
  else if (commandName === "provinces") {
    try {
      const plates = await Plate.find({ userId: interaction.user.id });

      if (plates.length === 0) {
        return interaction.reply({
          content: "You haven't collected any plates yet!",
          ephemeral: true,
        });
      }

      // Count plates by province
      const provinceCount = {};
      const provinceScore = {};

      plates.forEach((plate) => {
        provinceCount[plate.provinceCode] =
          (provinceCount[plate.provinceCode] || 0) + 1;
        provinceScore[plate.provinceCode] =
          (provinceScore[plate.provinceCode] || 0) + plate.totalScore;
      });

      // Sort provinces by count
      const sortedProvinces = Object.entries(provinceCount).sort(
        (a, b) => b[1] - a[1]
      );

      // Format province data
      const provincesList = sortedProvinces
        .slice(0, 15)
        .map(
          ([province, count]) =>
            `${province}: ${count} plates (${provinceScore[province]} pts)`
        )
        .join("\n");

      // Get total number of provinces in Turkey
      const totalProvinces = 81;
      const collectedProvinces = Object.keys(provinceCount).length;

      const embed = new EmbedBuilder()
        .setTitle(`${interaction.user.username}'s Province Statistics`)
        .setDescription(
          `You've collected plates from ${collectedProvinces} out of ${totalProvinces} provinces (${Math.round(
            (collectedProvinces / totalProvinces) * 100
          )}%).`
        )
        .addFields({ name: "Top Provinces", value: provincesList || "None" })
        .setColor("#3498DB");

      // Add missing provinces if not too many
      if (collectedProvinces < 40) {
        const missingProvinces = [];
        for (let i = 1; i <= totalProvinces; i++) {
          const provinceCode = i.toString().padStart(2, "0");
          if (!provinceCount[provinceCode]) {
            missingProvinces.push(provinceCode);
          }
        }

        if (missingProvinces.length > 0) {
          embed.addFields({
            name: `Missing Provinces (${missingProvinces.length})`,
            value:
              missingProvinces.slice(0, 20).join(", ") +
              (missingProvinces.length > 20 ? ", and more..." : ""),
          });
        }
      }

      interaction.reply({ embeds: [embed] });
    } catch (err) {
      console.error("Error retrieving province statistics:", err);
      interaction.reply({
        content:
          "There was an error retrieving province statistics. Please try again.",
        ephemeral: true,
      });
    }
  }

  // Command: View plates by type
  else if (commandName === "types") {
    try {
      const plates = await Plate.find({ userId: interaction.user.id });

      if (plates.length === 0) {
        return interaction.reply({
          content: "You haven't collected any plates yet!",
          ephemeral: true,
        });
      }

      // Group by plate type
      const typeGroups = {};

      plates.forEach((plate) => {
        if (!typeGroups[plate.plateType]) {
          typeGroups[plate.plateType] = [];
        }
        typeGroups[plate.plateType].push(plate);
      });

      // Sort types by count
      const sortedTypes = Object.entries(typeGroups).sort(
        (a, b) => b[1].length - a[1].length
      );

      const embed = new EmbedBuilder()
        .setTitle(`${interaction.user.username}'s Plate Types`)
        .setDescription(
          `You've collected ${
            Object.keys(typeGroups).length
          } different types of plates.`
        )
        .setColor("#9B59B6");

      // Add fields for each type
      sortedTypes.forEach(([type, plates]) => {
        const examplePlates = plates
          .sort((a, b) => b.totalScore - a.totalScore)
          .slice(0, 3)
          .map((p) => `${p.plateText} (${p.totalScore} pts)`)
          .join(", ");

        embed.addFields({
          name: `${getPlateTypeDisplay(type)} (${plates.length})`,
          value: examplePlates || "None",
        });
      });

      interaction.reply({ embeds: [embed] });
    } catch (err) {
      console.error("Error retrieving plate types:", err);
      interaction.reply({
        content: "There was an error retrieving plate types. Please try again.",
        ephemeral: true,
      });
    }
  }

  // Command: View rarest plates
  else if (commandName === "rare") {
    try {
      // Get the rarest plates globally
      const rarestPlates = await Plate.find()
        .sort({ totalScore: -1 })
        .limit(10);

      if (rarestPlates.length === 0) {
        return interaction.reply({
          content: "No plates have been collected yet!",
          ephemeral: true,
        });
      }

      const embed = new EmbedBuilder()
        .setTitle("💎 Rarest License Plates")
        .setDescription("The highest-scoring plates collected so far:")
        .setColor("#9B59B6");

      // Format plates list
      const platesList = rarestPlates
        .map(
          (plate, index) =>
            `**${index + 1}.** ${plate.plateText} - ${
              plate.totalScore
            } pts ${getScoreEmoji(plate.totalScore)} (${getPlateTypeDisplay(
              plate.plateType
            )}, collected by ${plate.username})`
        )
        .join("\n");

      embed.addFields({ name: "Top 10 Plates", value: platesList });

      interaction.reply({ embeds: [embed] });
    } catch (err) {
      console.error("Error retrieving rarest plates:", err);
      interaction.reply({
        content:
          "There was an error retrieving the rarest plates. Please try again.",
        ephemeral: true,
      });
    }
  }

  // Command: Help
  else if (commandName === "platehelp") {
    const embed = new EmbedBuilder()
      .setTitle("License Plate Collector - Help")
      .setDescription(
        "Collect Turkish license plates you spot and earn points based on rarity!"
      )
      .addFields(
        {
          name: "/addplate <plate>",
          value:
            "Add a plate to your collection\nExample: /addplate plate:34ABC123",
        },
        {
          name: "/mycollection",
          value: "View your plate collection and stats",
        },
        { name: "/leaderboard", value: "See top collectors ranked by score" },
        {
          name: "/plateinfo <plate>",
          value:
            "Get info about a specific plate\nExample: /plateinfo plate:06XYZ789",
        },
        { name: "/provinces", value: "View your collection by province" },
        { name: "/types", value: "View your collection by plate type" },
        {
          name: "/rare",
          value: "See the highest-scoring plates collected so far",
        },
        {
          name: "Special Plate Types",
          value:
            "The bot automatically detects plate types based on letter patterns:\n• AA - Universities\n• A/AAA - Police\n• JAA - Gendarmerie\n• SGH - Coast Guard\n• CD - Diplomatic\n• CC - Consulates\n• MA-MZ - Foreign residents\n• TAA-TKZ - Taxis",
        },
        {
          name: "Scoring System",
          value:
            "Points are based on province rarity, letter patterns, low digits, and special plate types.",
        }
      )
      .setColor("#2ECC71")
      .setFooter({ text: "Happy plate hunting!" });

    interaction.reply({ embeds: [embed] });
  }
});

function getScoreEmoji(score) {
  if (score >= 1000) return "💎"; // Diamond - extremely rare
  if (score >= 500) return "👑"; // Crown - very rare
  if (score >= 250) return "🌟"; // Star with sparkles - rare
  if (score >= 100) return "⭐"; // Star - uncommon
  if (score >= 50) return "✨"; // Sparkles - slightly uncommon
  return "🔹"; // Blue dot - common
}

function getScoreColor(score) {
  if (score >= 1000) return "#9C27B0"; // Purple - extremely rare
  if (score >= 500) return "#673AB7"; // Deep Purple - very rare
  if (score >= 250) return "#3F51B5"; // Indigo - rare
  if (score >= 100) return "#2196F3"; // Blue - uncommon
  if (score >= 50) return "#4CAF50"; // Green - slightly uncommon
  return "#FF9800"; // Orange - common
}

// Bot login and startup
client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  // Set the bot's activity
  client.user.setActivity("for license plates", { type: "WATCHING" });

  // Register slash commands
  try {
    await registerCommands();
    console.log("Slash commands registered successfully!");
  } catch (error) {
    console.error("Error registering slash commands:", error);
  }
});

client.login(process.env.DISCORD_TOKEN);
