import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { BackButtonDirective } from './directives/back-button.directive';
import { BottomSpacerComponent } from './components/bottom-spacer/bottom-spacer.component';

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    IonicModule,
    BackButtonDirective,
    BottomSpacerComponent
  ],
  exports: [
    BackButtonDirective,
    BottomSpacerComponent
  ]
})
export class SharedModule { }
