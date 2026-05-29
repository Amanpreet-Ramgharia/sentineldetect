// lib/mitre/threat-groups.ts
// Curated threat actor → MITRE technique mapping

export interface ThreatGroup {
  id: string; name: string; aliases: string[]
  country: string; motivation: string; sectors: string[]
  techniques: string[]; color: string
}

export const THREAT_GROUPS: ThreatGroup[] = [
  { id:'G0016', name:'APT29', aliases:['Cozy Bear','NOBELIUM','Midnight Blizzard'],
    country:'Russia', motivation:'espionage', color:'#ef4444',
    sectors:['Government','Defense','Technology','Healthcare'],
    techniques:['T1078','T1566.001','T1566.002','T1059.001','T1059.003','T1053.005',
      'T1027','T1070.001','T1070.004','T1021.001','T1021.002','T1003.001','T1558.003',
      'T1071.001','T1071.004','T1041','T1547.001','T1190','T1562.001','T1555.003',
      'T1036','T1105','T1090','T1112','T1572'] },
  { id:'G0007', name:'APT28', aliases:['Fancy Bear','Sofacy','Forest Blizzard','STRONTIUM'],
    country:'Russia', motivation:'espionage', color:'#f97316',
    sectors:['Government','Military','Defense','Media'],
    techniques:['T1566.001','T1190','T1059.001','T1059.003','T1047','T1070.001',
      'T1110.003','T1036','T1027','T1071.001','T1041','T1053.005','T1548',
      'T1055','T1082','T1021.001','T1021.002','T1003','T1558'] },
  { id:'G0032', name:'Lazarus Group', aliases:['HIDDEN COBRA','Zinc','Diamond Sleet'],
    country:'North Korea', motivation:'financial | espionage', color:'#8b5cf6',
    sectors:['Financial','Cryptocurrency','Defense','Entertainment'],
    techniques:['T1566.002','T1204.002','T1059.001','T1053.005','T1027','T1055',
      'T1486','T1041','T1071.001','T1078','T1036','T1070','T1105','T1547.001',
      'T1021.001','T1003.001','T1562','T1090'] },
  { id:'G0046', name:'FIN7', aliases:['Carbon Spider','Sangria Tempest'],
    country:'Unknown', motivation:'financial', color:'#10b981',
    sectors:['Retail','Hospitality','Finance'],
    techniques:['T1566.001','T1204.002','T1059.001','T1059.003','T1055','T1027',
      'T1003.001','T1041','T1071.001','T1036','T1547.001','T1053.005',
      'T1021.001','T1021.002','T1112','T1057','T1082'] },
  { id:'G1017', name:'Volt Typhoon', aliases:['Bronze Silhouette','DEV-0391'],
    country:'China', motivation:'espionage | pre-positioning', color:'#06b6d4',
    sectors:['Critical Infrastructure','Communications','Government'],
    techniques:['T1078','T1190','T1021.001','T1003.001','T1070.001','T1082',
      'T1046','T1090','T1048','T1033','T1049','T1069','T1135','T1016',
      'T1059.001','T1059.003','T1036','T1105'] },
  { id:'G0096', name:'APT41', aliases:['Double Dragon','Barium','Winnti','Wicked Panda'],
    country:'China', motivation:'espionage | financial', color:'#eab308',
    sectors:['Healthcare','Technology','Telecom','Finance','Gaming'],
    techniques:['T1566.001','T1190','T1059.001','T1078','T1027','T1036',
      'T1055','T1041','T1071.001','T1053.005','T1547.001','T1112','T1486',
      'T1003.001','T1558.003','T1021.001','T1070','T1090'] },
  { id:'G0034', name:'Sandworm', aliases:['Voodoo Bear','Seashell Blizzard','IRIDIUM'],
    country:'Russia', motivation:'disruption | espionage', color:'#ec4899',
    sectors:['Energy','Critical Infrastructure','Government'],
    techniques:['T1190','T1059.001','T1059.003','T1486','T1490','T1070.001',
      'T1027','T1562.001','T1021.001','T1055','T1036','T1105','T1547.001',
      'T1489','T1485','T1499'] },
  { id:'G0114', name:'Scattered Spider', aliases:['LAPSUS$','Octo Tempest'],
    country:'Unknown', motivation:'financial | extortion', color:'#a855f7',
    sectors:['Technology','Telecom','Finance','Gaming'],
    techniques:['T1078','T1566.004','T1621','T1110.003','T1059.001','T1041',
      'T1567','T1021.001','T1552','T1528','T1539','T1136','T1098'] },
  { id:'G1006', name:'BlackCat/ALPHV', aliases:['Noberus','UNC4466'],
    country:'Unknown', motivation:'ransomware', color:'#64748b',
    sectors:['Healthcare','Finance','Manufacturing','Legal'],
    techniques:['T1566.001','T1078','T1059.001','T1027','T1486','T1490',
      'T1041','T1021.001','T1021.002','T1003.001','T1070','T1562',
      'T1547.001','T1482','T1016'] },
  { id:'G0065', name:'Kimsuky', aliases:['Thallium','Emerald Sleet','APT43'],
    country:'North Korea', motivation:'espionage', color:'#84cc16',
    sectors:['Government','Think Tanks','Defense','Energy'],
    techniques:['T1566.001','T1566.002','T1059.001','T1053.005','T1027',
      'T1071.001','T1041','T1547.001','T1003','T1082','T1016','T1033',
      'T1021.001','T1036','T1055'] },
]

export function buildTechniqueGroupMap(): Record<string, string[]> {
  const map: Record<string, string[]> = {}
  for (const group of THREAT_GROUPS) {
    for (const tech of group.techniques) {
      const base = tech.split('.')[0]
      for (const key of [tech, base]) {
        if (!map[key]) map[key] = []
        if (!map[key].includes(group.name)) map[key].push(group.name)
      }
    }
  }
  return map
}
