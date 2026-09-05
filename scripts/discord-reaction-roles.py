"""
Discord Reaction Role Bot with Password Protection
- Auto-assigns "New Member" role to new members
- Handles reaction roles in #welcome
- Admin/Mod roles require a password
Run: DISCORD_BOT_TOKEN=xxx python3 scripts/discord-reaction-roles.py
"""
import discord
from discord.ext import commands
import os

# Load from environment variable
BOT_TOKEN = os.environ.get("DISCORD_BOT_TOKEN")
if not BOT_TOKEN:
    print("Error: Set DISCORD_BOT_TOKEN environment variable")
    exit(1)

GUILD_ID = int(os.environ.get("DISCORD_GUILD_ID", "1545640372112203818"))
WELCOME_CHANNEL_ID = int(os.environ.get("DISCORD_WELCOME_CHANNEL_ID", "1545658714873270327"))
ROLE_MESSAGE_ID = int(os.environ.get("DISCORD_ROLE_MESSAGE_ID", "1545663659005575260"))

# Role IDs
NEW_MEMBER_ROLE_ID = int(os.environ.get("NEW_MEMBER_ROLE_ID", "1545669285613928478"))
MEMBER_ROLE_ID = int(os.environ.get("MEMBER_ROLE_ID", "1545658478486360114"))
MOD_ROLE_ID = int(os.environ.get("MOD_ROLE_ID", "1545658604252696577"))
ADMIN_ROLE_ID = int(os.environ.get("ADMIN_ROLE_ID", "1545658601522331699"))

# Password for Admin/Mod roles
SECRET_PASSWORD = os.environ.get("DISCORD_SECRET_PASSWORD", "codehub2026")

# Emoji to Role mapping
REACTION_ROLES = {
    "🟢": MEMBER_ROLE_ID,     # Member (free)
    "🔵": MOD_ROLE_ID,        # Moderator (password required)
    "🔴": ADMIN_ROLE_ID,      # Admin (password required)
}

# Track who has entered the password
password_pending = set()

intents = discord.Intents.default()
intents.reactions = True
intents.members = True
intents.message_content = True

bot = commands.Bot(command_prefix="!", intents=intents)

@bot.event
async def on_ready():
    print(f"✅ Logged in as {bot.user.name}")
    print(f"📡 Watching message {ROLE_MESSAGE_ID} for reactions")
    print(f"🔑 Admin/Mod password: {SECRET_PASSWORD}")
    print("Bot is running!")

@bot.event
async def on_member_join(member):
    """Auto-assign New Member role to new members"""
    guild = member.guild
    role = guild.get_role(NEW_MEMBER_ROLE_ID)
    if role:
        await member.add_roles(role)
        print(f"✅ Auto-assigned New Member role to {member.display_name}")
        
        # Send welcome DM
        try:
            await member.send(
                f"👋 Welcome to **{guild.name}**!\n\n"
                f"You've been assigned the **New Member** role.\n"
                f"Check out <#{WELCOME_CHANNEL_ID}> to get your full access role!\n\n"
                f"📋 Read the rules in <#1545666134638985226> first."
            )
        except:
            pass

@bot.event
async def on_raw_reaction_add(payload):
    if payload.message_id != ROLE_MESSAGE_ID:
        return
    if payload.member.bot:
        return
    
    emoji = str(payload.emoji)
    if emoji not in REACTION_ROLES:
        return
    
    role_id = REACTION_ROLES[emoji]
    guild = bot.get_guild(GUILD_ID)
    role = guild.get_role(role_id)
    
    if emoji == "🟢":
        # Member role - free for all
        await payload.member.add_roles(role)
        # Also remove New Member role
        new_member_role = guild.get_role(NEW_MEMBER_ROLE_ID)
        if new_member_role in payload.member.roles:
            await payload.member.remove_roles(new_member_role)
        print(f"✅ Assigned {role.name} to {payload.member.display_name}")
        
        # Send confirmation DM
        try:
            await payload.member.send(
                f"✅ You've been assigned the **Member** role!\n"
                f"You now have access to all public channels. Enjoy!"
            )
        except:
            pass
    
    elif emoji in ("🔵", "🔴"):
        # Mod/Admin - require password
        password_pending.add(payload.user_id)
        role_name = "Moderator" if emoji == "🔵" else "Admin"
        
        # Remove the reaction
        channel = bot.get_channel(payload.channel_id)
        message = await channel.fetch_message(payload.message_id)
        await message.remove_reaction(emoji, payload.member)
        
        # Send DM asking for password
        try:
            await payload.member.send(
                f"🔐 **{role_name} Role**\n\n"
                f"This role requires a password.\n"
                f"Please type the password in this DM.\n\n"
                f"*Hint: Ask the server owner for the password.*"
            )
        except:
            # Can't DM them, try in channel
            try:
                channel = bot.get_channel(WELCOME_CHANNEL_ID)
                await channel.send(
                    f"{payload.member.mention} I sent you a DM about the **{role_name}** role. "
                    f"Please check your DMs and enter the password there.",
                    delete_after=10
                )
            except:
                pass
        
        print(f"🔐 {payload.member.display_name} requested {role_name} role - awaiting password")

@bot.event
async def on_message(message):
    """Handle password input in DMs"""
    if message.author.bot:
        return
    
    # Check if this is a DM and user is in password_pending
    if isinstance(message.channel, discord.DMChannel):
        if message.author.id in password_pending:
            if message.content.strip().lower() == SECRET_PASSWORD.lower():
                # Password correct - assign appropriate role
                guild = bot.get_guild(GUILD_ID)
                member = guild.get_member(message.author.id)
                
                if member:
                    # Check which role they were trying to get
                    # For simplicity, give them Moderator (can be upgraded manually)
                    mod_role = guild.get_role(MOD_ROLE_ID)
                    await member.add_roles(mod_role)
                    
                    # Remove New Member role
                    new_member_role = guild.get_role(NEW_MEMBER_ROLE_ID)
                    if new_member_role in member.roles:
                        await member.remove_roles(new_member_role)
                    
                    password_pending.discard(message.author.id)
                    
                    await message.send(
                        f"✅ Password accepted! You've been assigned the **Moderator** role.\n"
                        f"You now have access to manage messages and channels."
                    )
                    print(f"✅ Password accepted for {member.display_name} - assigned Moderator")
            else:
                await message.send("❌ Incorrect password. Try again or contact the server owner.")
    
    await bot.process_commands(message)

@bot.event
async def on_raw_reaction_remove(payload):
    if payload.message_id != ROLE_MESSAGE_ID:
        return
    
    guild = bot.get_guild(GUILD_ID)
    member = guild.get_member(payload.user_id)
    if member and not member.bot:
        emoji = str(payload.emoji)
        if emoji in REACTION_ROLES:
            role_id = REACTION_ROLES[emoji]
            role = guild.get_role(role_id)
            if role:
                await member.remove_roles(role)
                print(f"❌ Removed {role.name} from {member.display_name}")

@bot.command(name="setup-roles")
@commands.has_permissions(administrator=True)
async def setup_roles(ctx):
    """Create the role selection message in #welcome"""
    channel = bot.get_channel(WELCOME_CHANNEL_ID)
    embed = discord.Embed(
        title="🎭 Get Your Role!",
        description=(
            "React below to get your role:\n\n"
            "🟢 — **Member** (free — gives full access)\n"
            "🔵 — **Moderator** (password required)\n"
            "🔴 — **Admin** (password required)\n\n"
            "*Admin/Mod roles require a password from the server owner.*"
        ),
        color=0x5865F2
    )
    embed.set_footer(text="Hermes Agent • Role Selection")
    
    message = await channel.send(embed=embed)
    await message.add_reaction("🟢")
    await message.add_reaction("🔵")
    await message.add_reaction("🔴")
    
    await ctx.send(f"✅ Role selection message created! Message ID: {message.id}")

if __name__ == "__main__":
    bot.run(BOT_TOKEN)
