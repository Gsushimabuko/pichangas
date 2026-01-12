import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { supabase } from '../../supabase.client';

interface Player {
  id: number;
  name: string;
  position: 'attack' | 'midfield' | 'defense' | 'GK';
  created_at: string;
}

interface Match {
  id: number;
  name: string;
  createdAt: string;
  date: string;
  teams: { teamA: number[]; teamB: number[] };
  winner: { team: string } | null;
}

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.css'
})
export class AdminComponent implements OnInit {
            playerMatchesCount: { [playerId: number]: number } = {};
          getChecked(event: Event): boolean {
            return (event.target && (event.target as HTMLInputElement).checked) || false;
          }
        onMatchFilterChange(matchId: number, checked: boolean) {
          if (checked) {
            if (!this.selectedMatchIds.includes(matchId)) {
              this.selectedMatchIds.push(matchId);
            }
          } else {
            this.selectedMatchIds = this.selectedMatchIds.filter(id => id !== matchId);
          }
          this.loadPlayerAverages();
        }
      selectedMatchIds: number[] = [];
    playerAverages: { [playerId: number]: number } = {};
  players: Player[] = [];
  filteredPlayers: Player[] = [];
  selectedPositionFilter: 'attack' | 'midfield' | 'defense' | 'GK' | '' = '';
  newPlayerPosition: 'attack' | 'midfield' | 'defense' | 'GK' | '' = '';
  matches: Match[] = [];
  newPlayerName = '';
  newMatchName = '';
  newMatchDate = '';

  selectedMatchId: number | null = null;
  selectedPlayerToAdd: number | null = null;
  selectedTeam: 'A' | 'B' | null = null;
  selectedWinnerTeam: 'A' | 'B' | null = null;

  async ngOnInit() {
    await this.loadPlayers();
    await this.loadMatches();
    this.selectedMatchIds = this.matches.map(m => m.id); // por defecto todos seleccionados
    await this.loadPlayerAverages();
  }

  async loadPlayers() {
    const { data, error } = await supabase.from('player').select('*');
    if (error) console.error(error);
    else {
      this.players = data as Player[];
      this.applyPositionFilter();
      await this.loadPlayerAverages();
    }
  }

  async loadPlayerAverages() {
      // Calcular cantidad de partidos jugados por jugador
      const matchesCount: { [playerId: number]: Set<number> } = {};
    if (!this.selectedMatchIds.length) {
      this.playerAverages = {};
      return;
    }
    const { data, error } = await supabase.from('vote').select('fk_player_vote, score, fk_match');
    if (error) {
      console.error(error);
      this.playerAverages = {};
      return;
    }
    const averages: { [playerId: number]: { sum: number; count: number } } = {};
    for (const vote of data as any[]) {
      if (!this.selectedMatchIds.includes(vote.fk_match)) continue;
      const playerId = vote.fk_player_vote;
      if (!averages[playerId]) averages[playerId] = { sum: 0, count: 0 };
      averages[playerId].sum += vote.score;
      averages[playerId].count += 1;
      if (!matchesCount[playerId]) matchesCount[playerId] = new Set<number>();
      matchesCount[playerId].add(vote.fk_match);
    }
    this.playerMatchesCount = {};
    for (const playerId in matchesCount) {
      this.playerMatchesCount[+playerId] = matchesCount[playerId].size;
    }
    this.playerAverages = {};
    for (const playerId in averages) {
      const { sum, count } = averages[playerId];
      this.playerAverages[+playerId] = count ? +(sum / count).toFixed(2) : 0;
    }
  }

  applyPositionFilter() {
    let filtered = !this.selectedPositionFilter
      ? this.players
      : this.players.filter(p => p.position === this.selectedPositionFilter);
    this.filteredPlayers = filtered.slice().sort((a, b) => {
      const scoreA = this.playerAverages[a.id] ?? 0;
      const scoreB = this.playerAverages[b.id] ?? 0;
      return scoreB - scoreA;
    });
  }

  async loadMatches() {
    const { data, error } = await supabase.from('match').select('*');
    if (error) console.error(error);
    else this.matches = data as Match[];
  }

  async addPlayer() {
    if (!this.newPlayerName.trim() || !this.newPlayerPosition) return;
    const { error } = await supabase.from('player').insert({ name: this.newPlayerName, position: this.newPlayerPosition });
    if (error) console.error(error);
    else {
      this.newPlayerName = '';
      this.newPlayerPosition = '';
      await this.loadPlayers();
    }
  }

  async deletePlayer(id: number) {
    if (confirm('¿Estás seguro de eliminar este jugador? Esto eliminará todos sus votos.')) {
      const { error } = await supabase.from('player').delete().eq('id', id);
      if (error) console.error(error);
      else await this.loadPlayers();
    }
  }

  async createMatch() {
    if (!this.newMatchName.trim() || !this.newMatchDate) return;
    const { error } = await supabase.from('match').insert({
      name: this.newMatchName,
      date: this.newMatchDate,
      teams: { teamA: [], teamB: [] },
      winner: null
    });
    if (error) console.error(error);
    else {
      this.newMatchName = '';
      this.newMatchDate = '';
      await this.loadMatches();
    }
  }

  async deleteMatch(id: number) {
    if (confirm('¿Estás seguro de eliminar este partido? Esto eliminará todos los votos relacionados.')) {
      const { error } = await supabase.from('match').delete().eq('id', id);
      if (error) console.error(error);
      else await this.loadMatches();
    }
  }

  async addPlayerToTeam() {
    if (!this.selectedMatchId || !this.selectedPlayerToAdd || !this.selectedTeam) { return; }
    const match = this.matches.find(m => m.id === this.selectedMatchId);
    if (!match) { return; }
    const team = this.selectedTeam === 'A' ? 'teamA' : 'teamB';
    if (match.teams[team].includes(this.selectedPlayerToAdd)) { return; } // already in
    match.teams[team].push(this.selectedPlayerToAdd);
    const { error } = await supabase.from('match').update({ teams: match.teams }).eq('id', this.selectedMatchId);
    if (error) console.error(error);
    else await this.loadMatches();
  }

  async setWinner() {
    if (!this.selectedMatchId || !this.selectedWinnerTeam) { return; }
    const winner = { team: this.selectedWinnerTeam };
    const { error } = await supabase.from('match').update({ winner }).eq('id', this.selectedMatchId);
    if (error) console.error(error);
    else await this.loadMatches();
  }

  async removePlayerFromTeam(playerId: number, team: 'A' | 'B') {
    if (!this.selectedMatchId) { return; }
    const match = this.matches.find(m => m.id === this.selectedMatchId);
    if (!match) { return; }
    const teamKey = team === 'A' ? 'teamA' : 'teamB';
    match.teams[teamKey] = match.teams[teamKey].filter(id => id !== playerId);
    const { error } = await supabase.from('match').update({ teams: match.teams }).eq('id', this.selectedMatchId);
    if (error) console.error(error);
    else await this.loadMatches();
  }

  getPlayerName(id: number): string {
    return this.players.find(p => p.id === id)?.name || 'Unknown';
  }

  getMatch(id: number): Match | undefined {
    return this.matches.find(m => m.id === id);
  }
}
