import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { supabase } from '../../supabase.client';

interface Player {
  id: number;
  name: string;
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
  players: Player[] = [];
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
  }

  async loadPlayers() {
    const { data, error } = await supabase.from('player').select('*');
    if (error) console.error(error);
    else this.players = data as Player[];
  }

  async loadMatches() {
    const { data, error } = await supabase.from('match').select('*');
    if (error) console.error(error);
    else this.matches = data as Match[];
  }

  async addPlayer() {
    if (!this.newPlayerName.trim()) return;
    const { error } = await supabase.from('player').insert({ name: this.newPlayerName });
    if (error) console.error(error);
    else {
      this.newPlayerName = '';
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
    if (!this.selectedMatchId || !this.selectedPlayerToAdd || !this.selectedTeam) return;
    const match = this.matches.find(m => m.id === this.selectedMatchId);
    if (!match) return;
    const team = this.selectedTeam === 'A' ? 'teamA' : 'teamB';
    if (match.teams[team].includes(this.selectedPlayerToAdd)) return; // already in
    match.teams[team].push(this.selectedPlayerToAdd);
    const { error } = await supabase.from('match').update({ teams: match.teams }).eq('id', this.selectedMatchId);
    if (error) console.error(error);
    else await this.loadMatches();
  }

  async setWinner() {
    if (!this.selectedMatchId || !this.selectedWinnerTeam) return;
    const winner = { team: this.selectedWinnerTeam };
    const { error } = await supabase.from('match').update({ winner }).eq('id', this.selectedMatchId);
    if (error) console.error(error);
    else await this.loadMatches();
  }

  async removePlayerFromTeam(playerId: number, team: 'A' | 'B') {
    if (!this.selectedMatchId) return;
    const match = this.matches.find(m => m.id === this.selectedMatchId);
    if (!match) return;
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
