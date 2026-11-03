// The single source of app state, shared by every module.
export const store = { data: null, state: null, snapshot: null, unreadable: false, photoUrls: new Map() };
export const campaign = () => store.state.campaigns[store.state.season];
export const club = id => store.data.teams.find(team => team.id === id);
export const teams = () => store.data.seasons[store.state.season].map(club);
export const record = id => campaign().records.find(item => item.clubId === id);
// A photo is a stored blob id, an inline data URL (old saves) or a blob: URL (unsaved preview).
export const photoUrl = photo => /^(data|blob):/.test(photo ?? '') ? photo : store.photoUrls.get(photo) ?? '';
