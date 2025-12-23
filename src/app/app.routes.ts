import { Routes } from '@angular/router';
import { SelectPlayerComponent } from './pages/select-player/select-player.component';
import { VoteComponent } from './pages/vote/vote.component';
import { ResultsComponent } from './pages/results/results.component';
import { AdminComponent } from './pages/admin/admin.component';

export const routes: Routes = [
    //redirect to home when path is empty
  { path: '', redirectTo: '/home', pathMatch: 'full' },
  { path: 'home', component: SelectPlayerComponent },
  { path: 'vote', component: VoteComponent },
  { path: 'results', component: ResultsComponent },
  { path: 'admin', component: AdminComponent },
];
