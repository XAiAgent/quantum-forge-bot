// Add this code after the ready event handler initialization
client.once('ready', async () => {
  console.log(`Quantum-Forge initialized as ${client.user.tag}`);

  // Update bot username if needed
  if (client.user.username !== 'Quantum-Forge') {
    try {
      await client.user.setUsername('Quantum-Forge');
      console.log('NEXUS: Bot designation updated to Quantum-Forge');
    } catch (error) {
      console.error('PARADOX: Username update error:', error);
      console.log('Note: Username can only be changed twice per hour due to Discord rate limits');
    }
  }

  // Rest of your ready event code...
});

