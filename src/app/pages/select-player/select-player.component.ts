import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { supabase } from '../../supabase.client';

interface Player {
  id: number;
  name: string;
}

interface Match {
  id: number;
  name: string;
  date: string;
  teamA: string[];
  teamAIds: number[];
  teamB: string[];
  teamBIds: number[];
  winner: string | null;
}

@Component({
  selector: 'app-select-player',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './select-player.component.html',
  styleUrl: './select-player.component.css'
})
export class SelectPlayerComponent implements OnInit {
  matches: Match[] = [];
  players: Player[] = [];
  selectedMatch: Match | null = null;
  selectedVoter: number | null = null;
  playerRatings: { [key: number]: number | null } = {};
  playerAverages: { [key: number]: { sum: number; count: number } } = {};
  voterCounts: { [key: number]: number } = {};
  mvp: { name: string; average: number } | null = null;
  errorMessage: string = '';

  async ngOnInit() {
    // Fetch players first
    const { data: playersData, error: playersError } = await supabase.from('player').select('*');
    if (playersError) {
      console.error('Error fetching players:', playersError);
      return;
    }
    this.players = playersData as Player[];

    // Fetch matches
    const { data: matchesData, error: matchesError } = await supabase.from('match').select('*');
    if (matchesError) {
      console.error('Error fetching matches:', matchesError);
      return;
    }

    // Map matches to include player names
    this.matches = matchesData.map((match: any) => ({
      id: match.id,
      name: match.name,
      date: match.date,
      teamA: match.teams.teamA.map((id: number) => this.players.find(p => p.id === id)?.name || 'Desconocido'),
      teamAIds: match.teams.teamA,
      teamB: match.teams.teamB.map((id: number) => this.players.find(p => p.id === id)?.name || 'Desconocido'),
      teamBIds: match.teams.teamB,
      winner: match.winner ? `Equipo ${match.winner.team}` : null
    }));
  }

  async onMatchSelect(event: Event) {
    const target = event.target as HTMLSelectElement;
    const matchId = +target.value;
    this.selectedMatch = this.matches.find(m => m.id === matchId) || null;

    // Reset ratings when match changes
    this.playerRatings = {};

    if (this.selectedMatch) {
      // Fetch votes for this match
      const { data: votesData, error: votesError } = await supabase
        .from('vote')
        .select('*')
        .eq('fk_match', this.selectedMatch.id);

      if (votesError) {
        console.error('Error fetching votes:', votesError);
        return;
      }

      // Compute player averages and voter counts
      this.playerAverages = {};
      this.voterCounts = {};

      votesData.forEach((vote: any) => {
        // Player averages
        if (!this.playerAverages[vote.fk_player_vote]) {
          this.playerAverages[vote.fk_player_vote] = { sum: 0, count: 0 };
        }
        this.playerAverages[vote.fk_player_vote].sum += vote.score;
        this.playerAverages[vote.fk_player_vote].count += 1;

        // Voter counts
        this.voterCounts[vote.fk_player_voter] = (this.voterCounts[vote.fk_player_voter] || 0) + 1;
      });

      // Compute MVP
      this.mvp = null;
      let maxAvg = -1;
      for (const playerId in this.playerAverages) {
        const avg = this.playerAverages[+playerId].sum / this.playerAverages[+playerId].count;
        if (avg > maxAvg) {
          maxAvg = avg;
          const player = this.players.find(p => p.id === +playerId);
          this.mvp = player ? { name: player.name, average: avg } : null;
        }
      }
    }
  }

  getCurrentMatchPlayers(): Player[] {
    if (!this.selectedMatch) return [];
    const ids = [...this.selectedMatch.teamAIds, ...this.selectedMatch.teamBIds];
    return this.players.filter(p => ids.includes(p.id));
  }

  allRatingsValid(): boolean {
    if (!this.selectedVoter || !this.selectedMatch) return false;
    // Solo los jugadores del partido, excepto el votante
    return this.getCurrentMatchPlayers().filter(p => p.id !== this.selectedVoter).every(p => {
      const rating = this.playerRatings[p.id];
      return rating !== undefined && rating !== null && rating >= 1 && rating <= 10;
    });
  }

  async onSubmitAllVotes() {
    this.errorMessage = '';
    if (!this.selectedMatch || !this.selectedVoter) {
      this.errorMessage = 'Debes seleccionar tu nombre y un partido.';
      return;
    }
    // Validar que todos los puntajes estén seleccionados
    const missingRatings = this.getCurrentMatchPlayers().filter(p => p.id !== this.selectedVoter).filter(p => {
      const rating = this.playerRatings[p.id];
      return rating === undefined || rating === null;
    });
    if (missingRatings.length > 0) {
      this.errorMessage = 'Debes calificar a todos los jugadores del partido.';
      return;
    }

    // Construir array de votos
    const votes = this.getCurrentMatchPlayers()
      .filter(p => p.id !== this.selectedVoter)
      .map(p => ({
        fk_player_voter: this.selectedVoter,
        fk_player_vote: p.id,
        score: this.playerRatings[p.id],
        fk_match: this.selectedMatch!.id
      }));

    const { error } = await supabase.from('vote').insert(votes);

    if (error) {
      console.error('Error submitting votes:', error);
      this.errorMessage = 'Error al enviar la votación.';
    } else {
      alert('Votación enviada exitosamente.');
      // Resetear calificaciones y votante
      this.selectedVoter = null;
      this.playerRatings = {};
      // Re-fetch votes to update averages and counts
      if (this.selectedMatch) {
        await this.onMatchSelect({ target: { value: this.selectedMatch.id.toString() } } as any);
      }
    }
  }

  getPlayerAverage(playerId: number): string {
    const avgData = this.playerAverages[playerId];
    if (!avgData || avgData.count === 0) return 'N/A';
    return (avgData.sum / avgData.count).toFixed(1);
  }

  getVoterCount(playerId: number): number {
    return this.voterCounts[playerId] || 0;
  }
}
