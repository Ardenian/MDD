import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs/operators';
import { ToastService } from './ui/services/toast.service';

@Component({
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.announceRouteChange());
  }

  private announceRouteChange(): void {
    const title = this.deepestRouteTitle();
    if (title) {
      this.toastService.show(`Navigated to ${title}`);
    }
  }

  private deepestRouteTitle(): string | undefined {
    let route = this.router.routerState.snapshot.root;
    while (route.firstChild) {
      route = route.firstChild;
    }
    return route.title;
  }
}
