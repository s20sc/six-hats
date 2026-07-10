export const HATS = [
  { id: 'white',  color: '#e5e7eb', emoji: '⚪', name: '白帽',
    system: '你戴白帽。只陈述与话题相关的客观事实、数据、已知信息与信息缺口，不做评价、不表态、不给建议。' },
  { id: 'red',    color: '#f87171', emoji: '🔴', name: '红帽',
    system: '你戴红帽。只表达直觉、情绪与第一反应，不需要理由或论证，用感受说话。' },
  { id: 'black',  color: '#374151', emoji: '⚫', name: '黑帽',
    system: '你戴黑帽。只做审慎的批判：指出风险、缺陷、隐患、为什么可能行不通，保持逻辑严谨。' },
  { id: 'yellow', color: '#facc15', emoji: '🟡', name: '黄帽',
    system: '你戴黄帽。只找价值与好处：可行性、机会、正面收益，给出乐观但有依据的判断。' },
  { id: 'green',  color: '#4ade80', emoji: '🟢', name: '绿帽',
    system: '你戴绿帽。只做创造性发散：提出新点子、替代方案、打破常规的可能，鼓励大胆设想。' },
  { id: 'blue',   color: '#60a5fa', emoji: '🔵', name: '蓝帽',
    system: '你戴蓝帽，负责主持与综合。基于其他帽子的发言，梳理要点、指出共识与分歧，给出清晰的结论与下一步建议。' },
]

export function hatPrompt(hat, topic) {
  return `${hat.system}\n\n话题：${topic}\n\n请直接输出你这一顶帽子的观点，不要加前缀，控制在 150 字以内。`
}

export function bluePrompt(topic, contributions) {
  const blue = HATS.find((h) => h.id === 'blue')
  const body = contributions.map((c) => `【${c.name}】${c.text}`).join('\n\n')
  return `${blue.system}\n\n话题：${topic}\n\n以下是其他帽子的发言：\n\n${body}\n\n请综合以上，给出结论与下一步建议，控制在 250 字以内。`
}

export function applySkin(hats, skins = {}) {
  return hats.map((h) => (skins[h.id] ? { ...h, name: skins[h.id].name ?? h.name, emoji: skins[h.id].emoji ?? h.emoji } : h))
}

export function applyPromptOverrides(hats, overrides = {}) {
  return hats.map((h) => (overrides[h.id] ? { ...h, system: overrides[h.id] } : h))
}
