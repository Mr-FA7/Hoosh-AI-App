// Deep Research capability — runs inside the Skill sandbox.
// It receives the capability object `hoosh` (built from GRANTED permissions)
// and an `input` ({ query }). All side effects route through the Tool Layer.
// It has NO require/process/Buffer and only the network capability it was granted.
module.exports.run = async function run(hoosh, input) {
  const query = (input && input.query) || '';
  if (!query) return { ok: false, error: 'query is required' };
  // `hoosh.research` is only present/allowed because the manifest declared
  // network hosts and the user granted them; otherwise this rejects.
  const result = await hoosh.research(query);
  await hoosh.memory.remember(`Researched: ${query}`, { tags: ['research'] });
  return { ok: true, result };
};
