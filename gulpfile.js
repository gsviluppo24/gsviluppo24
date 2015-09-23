/**
 * Opzioni disponibili:
 *
 * --env: string - Definisce l'ambiente di deploy - Default: staging
 * -- branch: string - Definisce il branch di git - Default: develop
 * -- dryrun: boolean - Se settato su false, effettua il deploy, altrimenti solo prova - Default: true
 * -- debug: boolean - Se settato su true, la console stamperà degli elementi di controllo -  Default: false
 * 
 * @author Cyril Dally
 * @data: 2015-09-23
 * 
 */

var gulp = require('gulp');
var os   = require('os');
var gulpif = require('gulp-if');
var uglify = require('gulp-uglify');
var minifyCss = require('gulp-minify-css');
var minimist = require('minimist');
var del = require('del');
var fs = require('fs');
var rsync = require('gulp-rsync');
var git = require('gulp-git');
var rename = require('gulp-rename');
var sass = require('gulp-sass');


var knownOptions = {
  string: 'env',
  default: { env: process.env.NODE_ENV || 'staging' }
};

// Crea un array unico
// TODO: capire come funziona di preciso
var options = minimist( process.argv.slice( 2 ), knownOptions );


// Sets the current env and sets the main variables
gulp.task( 'config', function() {

  var hostname = os.hostname();
  // if( hostname != 'TRLIVEBUILDER' ) {
  //   console.log( "NON SEI SULLA MACCHINA PONTE!\nhostname = " + hostname);
  //   return false;
  // }

  // Se non specificato l'env viene settato su develop
  env = undefined == options.env ? 'staging' : options.env;

  // Se non specificato il branch viene settato su develop
  branch = undefined == options.branch ? 'develop' : options.branch;

  if( env == 'production' && branch != 'master' ) {
    console.log( "NON PUOI DEPLOIARE IN PRODUZIONE DA QUESTO BRANCH!\nenv = " + env + "\nbranch = " + branch);
    return false;
  }

  // Se non specificato il dryrun viene settato su false
  dryrun = undefined == options.dryrun ? true : options.dryrun;

  // Se non specificato il debug viene settato su false
  debug = undefined == options.debug ? false : options.debug;

  // Di default il disco di destinazione è settato su quello di dev
  // Non è un'opzione modificabile
  url = 'disco/di/sviluppo/htdocs/';
  
  if( env == "production" ) {

    branch = 'master';
    url = 'disco/di/produzione/htdocs/';

    // Questo genera un errore: permessi ?
    // fs.createReadStream('.env.prod').pipe( fs.createWriteStream('.env') );
  }

  if( debug ) {
    console.log( "Task config: hostname = " + hostname );
    console.log( "Task config: env = " + env );
    console.log( "Task config: branch = " + branch );
    console.log( "Task config: url = " + url );
    console.log( "Task config: dryrun = " + dryrun );
  }
});


// Pulls the git down
// Depends on config
gulp.task('git-pull', ['config'], function() {

  if( debug ) {
    console.log( "Task git-pull: branch = " + branch );
  }

  // checkout: verificare sintassi
  git.checkout(branch, {}, function (err) {
    if (err) throw err;
  });

  git.pull('origin', branch, {}, function (err) {
    if (err) throw err;
  });
});




// Clean the css dist folder
// Depends on config
gulp.task( 'clean', ['config'], function () {
  return del([ 'css/*']);
});


// Minify all css and copy them to dist folder
// Depends on clean
gulp.task( 'cssmin', ['clean'], function() {

  if( debug ) {
    console.log( "Task cssmin: env = " + env );
  }

  return gulp.src( 'source/css/*.css' )
    .pipe(gulpif( env == "production", minifyCss() )) // only minify in production
    .pipe(gulp.dest('css'));
});

gulp.task('sync', function() {

  var file = fs.readFileSync('rsync-excludelist', "utf8");
  var arr = file.split("\n");

  if( debug ) {
    console.log( "Task sync: arr = " + arr );
  }

  gulp.src( process.cwd() )
    .pipe( gulpif( dryrun === false, rsync( {
        recursive: true,
        destination: '../rsync-test/suncharts',
        progress: true,
        incremental: true,
        exclude: arr
      } ) 
    )
  );

});

// Defines the tasks
gulp.task( 'check', [ 'config', 'git-pull' ] );
gulp.task( 'compile', [ 'check', 'clean', 'cssmin' ] );
gulp.task( 'deploy', [ 'deploy', 'sync' ] );