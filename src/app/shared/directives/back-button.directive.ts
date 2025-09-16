import { Directive, ElementRef, HostListener, Input, OnInit } from '@angular/core';
import { NavigationService } from '../../services/navigation.service';

@Directive({
  selector: '[appBackButton]',
  standalone: true
})
export class BackButtonDirective implements OnInit {
  @Input() customAction?: () => void;
  @Input() disabled = false;

  constructor(
    private el: ElementRef,
    private navigationService: NavigationService
  ) {}

  ngOnInit() {
    // Add visual feedback for back button
    this.el.nativeElement.style.cursor = 'pointer';
    this.el.nativeElement.setAttribute('role', 'button');
    this.el.nativeElement.setAttribute('aria-label', 'Go back');
  }

  @HostListener('click', ['$event'])
  onClick(event: Event) {
    if (this.disabled) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (this.customAction) {
      this.customAction();
    } else {
      this.navigationService.goBack();
    }
  }

  @HostListener('keydown.enter', ['$event'])
  @HostListener('keydown.space', ['$event'])
  onKeyDown(event: KeyboardEvent) {
    if (this.disabled) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (this.customAction) {
      this.customAction();
    } else {
      this.navigationService.goBack();
    }
  }
}

